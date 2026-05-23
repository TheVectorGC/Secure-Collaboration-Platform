package dev.identityservice.service.impl;

import dev.identityservice.util.StringNormalizer;
import dev.identityservice.exception.AccountNotFoundException;
import dev.identityservice.exception.DeviceNotFoundException;
import dev.identityservice.exception.DeviceRegistrationException;
import dev.identityservice.exception.DeviceRevokedException;
import dev.identityservice.model.dto.request.LoginRequestDto;
import dev.identityservice.model.dto.request.UpdateDeviceMetadataRequestDto;
import dev.identityservice.model.dto.response.ActiveDeviceResponseDto;
import dev.identityservice.model.dto.response.DeviceResponseDto;
import dev.identityservice.model.dto.response.InternalDeviceResponseDto;
import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.model.entity.AuthSessionEntity;
import dev.identityservice.model.entity.DeviceEntity;
import dev.identityservice.model.enumeration.AuthSessionStatus;
import dev.identityservice.model.enumeration.DevicePlatform;
import dev.identityservice.model.enumeration.DeviceStatus;
import dev.identityservice.repository.AccountRepository;
import dev.identityservice.repository.AuthSessionRepository;
import dev.identityservice.repository.DeviceRepository;
import dev.identityservice.service.DeviceService;
import dev.identityservice.outbox.IdentityOutboxService;
import dev.identityservice.mapper.DeviceMapper;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceServiceImpl implements DeviceService {
    private final AccountRepository accountRepository;
    private final DeviceRepository deviceRepository;
    private final AuthSessionRepository authSessionRepository;
    private final DeviceMapper deviceMapper;
    private final IdentityOutboxService identityOutboxService;

    @Override
    @Transactional
    public DeviceEntity resolveLoginDevice(AccountEntity accountEntity, LoginRequestDto loginRequestDto) {
        String clientInstallationId = StringNormalizer.trimToNull(loginRequestDto.clientInstallationId());

        if (loginRequestDto.deviceId() != null) {
            return resolveExistingDevice(accountEntity, loginRequestDto, clientInstallationId);
        }

        if (clientInstallationId != null) {
            return resolveDeviceByClientInstallation(accountEntity, loginRequestDto, clientInstallationId);
        }

        return createDevice(accountEntity, loginRequestDto, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DeviceResponseDto> getCurrentAccountDevices(String username) {
        AccountEntity accountEntity = findAccountByUsername(username);
        return deviceRepository.findByAccountId(accountEntity.getId()).stream()
                .map(deviceMapper::toDeviceResponseDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ActiveDeviceResponseDto> getActiveAccountDevices(UUID accountId) {
        return deviceRepository.findByAccountIdAndStatus(accountId, DeviceStatus.ACTIVE).stream()
                .map(deviceMapper::toActiveDeviceResponseDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public InternalDeviceResponseDto getInternalDevice(UUID deviceId) {
        DeviceEntity deviceEntity = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new DeviceNotFoundException("Device with ID '" + deviceId + "' not found."));

        return deviceMapper.toInternalDeviceResponseDto(deviceEntity);
    }

    @Override
    @Transactional
    public DeviceResponseDto updateCurrentAccountDeviceMetadata(
            String username,
            UUID deviceId,
            UpdateDeviceMetadataRequestDto requestDto
    ) {
        AccountEntity accountEntity = findAccountByUsername(username);
        DeviceEntity deviceEntity = findCurrentAccountDevice(accountEntity, deviceId);
        validateDeviceIsActive(deviceEntity);
        applyDeviceMetadata(deviceEntity, DeviceMetadataUpdate.fromRequest(requestDto));
        touchDevice(deviceEntity);

        DeviceEntity savedDeviceEntity = deviceRepository.save(deviceEntity);
        log.debug("Device metadata updated. Device ID: {}, account ID: {}.", savedDeviceEntity.getId(), savedDeviceEntity.getAccountId());
        return deviceMapper.toDeviceResponseDto(savedDeviceEntity);
    }

    @Override
    @Transactional
    public void revokeCurrentAccountDevice(String username, UUID deviceId) {
        AccountEntity accountEntity = findAccountByUsername(username);
        DeviceEntity deviceEntity = findCurrentAccountDevice(accountEntity, deviceId);

        if (deviceEntity.getStatus() == DeviceStatus.REVOKED) {
            log.info("Device is already revoked. Device ID: {}.", deviceId);
            return;
        }

        revokeDevice(deviceEntity);
        identityOutboxService.enqueueDeviceRevoked(accountEntity.getId(), deviceId);
        log.info("Device revoked. Device ID: {}, account ID: {}.", deviceId, accountEntity.getId());
    }

    private DeviceEntity resolveDeviceByClientInstallation(
            AccountEntity accountEntity,
            LoginRequestDto loginRequestDto,
            String clientInstallationId
    ) {
        return deviceRepository.findByAccountIdAndClientInstallationId(accountEntity.getId(), clientInstallationId)
                .map(deviceEntity -> refreshExistingDevice(deviceEntity, loginRequestDto))
                .orElseGet(() -> createDevice(accountEntity, loginRequestDto, clientInstallationId));
    }

    private DeviceEntity resolveExistingDevice(
            AccountEntity accountEntity,
            LoginRequestDto loginRequestDto,
            String clientInstallationId
    ) {
        DeviceEntity deviceEntity = deviceRepository.findByIdAndAccountId(loginRequestDto.deviceId(), accountEntity.getId())
                .orElseThrow(() -> new DeviceNotFoundException("Device with ID '" + loginRequestDto.deviceId() + "' not found."));

        validateDeviceIsActive(deviceEntity);

        if (clientInstallationId != null) {
            bindDeviceToClientInstallation(accountEntity.getId(), deviceEntity, clientInstallationId);
        }

        return refreshExistingDevice(deviceEntity, loginRequestDto);
    }

    private DeviceEntity refreshExistingDevice(DeviceEntity deviceEntity, LoginRequestDto loginRequestDto) {
        validateDeviceIsActive(deviceEntity);
        applyDeviceMetadata(deviceEntity, DeviceMetadataUpdate.fromLogin(loginRequestDto));
        touchDevice(deviceEntity);
        return deviceRepository.save(deviceEntity);
    }

    private void bindDeviceToClientInstallation(UUID accountId, DeviceEntity deviceEntity, String clientInstallationId) {
        if (clientInstallationId.equals(deviceEntity.getClientInstallationId())) {
            return;
        }

        deviceRepository.findByAccountIdAndClientInstallationId(accountId, clientInstallationId)
                .filter(conflictingDeviceEntity -> !conflictingDeviceEntity.getId().equals(deviceEntity.getId()))
                .ifPresent(this::detachClientInstallationFromConflictingDevice);

        deviceEntity.setClientInstallationId(clientInstallationId);
    }

    private void detachClientInstallationFromConflictingDevice(DeviceEntity conflictingDeviceEntity) {
        if (conflictingDeviceEntity.getStatus() == DeviceStatus.ACTIVE) {
            revokeDevice(conflictingDeviceEntity);
        }

        conflictingDeviceEntity.setClientInstallationId(null);
        conflictingDeviceEntity.setUpdatedAt(OffsetDateTime.now());
        deviceRepository.save(conflictingDeviceEntity);
        identityOutboxService.enqueueDeviceRevoked(conflictingDeviceEntity.getAccountId(), conflictingDeviceEntity.getId());
        log.warn("Duplicate client installation binding detached. Device ID: {}, account ID: {}.", conflictingDeviceEntity.getId(), conflictingDeviceEntity.getAccountId());
    }

    private DeviceEntity createDevice(
            AccountEntity accountEntity,
            LoginRequestDto loginRequestDto,
            String clientInstallationId
    ) {
        validateNewDeviceRequest(loginRequestDto);

        OffsetDateTime now = OffsetDateTime.now();
        DeviceEntity deviceEntity = DeviceEntity.builder()
                .accountId(accountEntity.getId())
                .deviceName(loginRequestDto.deviceName().trim())
                .platform(loginRequestDto.platform())
                .status(DeviceStatus.ACTIVE)
                .clientInstallationId(clientInstallationId)
                .clientVersion(StringNormalizer.trimToNull(loginRequestDto.clientVersion()))
                .osName(StringNormalizer.trimToNull(loginRequestDto.osName()))
                .osVersion(StringNormalizer.trimToNull(loginRequestDto.osVersion()))
                .architecture(StringNormalizer.trimToNull(loginRequestDto.architecture()))
                .hostname(StringNormalizer.trimToNull(loginRequestDto.hostname()))
                .lastSeenAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();

        DeviceEntity savedDeviceEntity = deviceRepository.save(deviceEntity);
        log.info("Device registered. Device ID: {}, account ID: {}.", savedDeviceEntity.getId(), accountEntity.getId());
        return savedDeviceEntity;
    }

    private void revokeDevice(DeviceEntity deviceEntity) {
        deviceEntity.setStatus(DeviceStatus.REVOKED);
        deviceEntity.setUpdatedAt(OffsetDateTime.now());
        deviceRepository.save(deviceEntity);
        revokeActiveDeviceSessions(deviceEntity.getId());
    }

    private void revokeActiveDeviceSessions(UUID deviceId) {
        List<AuthSessionEntity> activeSessions = authSessionRepository.findByDeviceIdAndStatus(deviceId, AuthSessionStatus.ACTIVE);
        activeSessions.forEach(authSessionEntity -> authSessionEntity.setStatus(AuthSessionStatus.REVOKED));
        authSessionRepository.saveAll(activeSessions);
    }

    private void validateNewDeviceRequest(LoginRequestDto loginRequestDto) {
        if (StringNormalizer.trimToNull(loginRequestDto.deviceName()) == null) {
            throw new DeviceRegistrationException("Device name is required for new device registration.");
        }

        if (loginRequestDto.platform() == null) {
            throw new DeviceRegistrationException("Device platform is required for new device registration.");
        }
    }

    private void validateDeviceIsActive(DeviceEntity deviceEntity) {
        if (deviceEntity.getStatus() == DeviceStatus.REVOKED) {
            throw new DeviceRevokedException("Device has been revoked.");
        }
    }

    private void applyDeviceMetadata(DeviceEntity deviceEntity, DeviceMetadataUpdate metadataUpdate) {
        setIfPresent(metadataUpdate.deviceName(), deviceEntity::setDeviceName);

        if (metadataUpdate.platform() != null) {
            deviceEntity.setPlatform(metadataUpdate.platform());
        }

        setIfPresent(metadataUpdate.clientVersion(), deviceEntity::setClientVersion);
        setIfPresent(metadataUpdate.osName(), deviceEntity::setOsName);
        setIfPresent(metadataUpdate.osVersion(), deviceEntity::setOsVersion);
        setIfPresent(metadataUpdate.architecture(), deviceEntity::setArchitecture);
        setIfPresent(metadataUpdate.hostname(), deviceEntity::setHostname);
        setIfPresent(metadataUpdate.deviceFingerprint(), deviceEntity::setDeviceFingerprint);
    }

    private void setIfPresent(String value, Consumer<String> setter) {
        if (value != null) {
            setter.accept(value);
        }
    }

    private void touchDevice(DeviceEntity deviceEntity) {
        OffsetDateTime now = OffsetDateTime.now();
        deviceEntity.setLastSeenAt(now);
        deviceEntity.setUpdatedAt(now);
    }

    private AccountEntity findAccountByUsername(String username) {
        return accountRepository.findByUsername(username)
                .orElseThrow(() -> new AccountNotFoundException("Account with username '" + username + "' not found."));
    }

    private DeviceEntity findCurrentAccountDevice(AccountEntity accountEntity, UUID deviceId) {
        return deviceRepository.findByIdAndAccountId(deviceId, accountEntity.getId())
                .orElseThrow(() -> new DeviceNotFoundException("Device with ID '" + deviceId + "' not found."));
    }

    private record DeviceMetadataUpdate(
            String deviceName,
            DevicePlatform platform,
            String clientVersion,
            String osName,
            String osVersion,
            String architecture,
            String hostname,
            String deviceFingerprint
    ) {
        private static DeviceMetadataUpdate fromLogin(LoginRequestDto loginRequestDto) {
            return new DeviceMetadataUpdate(
                    StringNormalizer.trimToNull(loginRequestDto.deviceName()),
                    loginRequestDto.platform(),
                    StringNormalizer.trimToNull(loginRequestDto.clientVersion()),
                    StringNormalizer.trimToNull(loginRequestDto.osName()),
                    StringNormalizer.trimToNull(loginRequestDto.osVersion()),
                    StringNormalizer.trimToNull(loginRequestDto.architecture()),
                    StringNormalizer.trimToNull(loginRequestDto.hostname()),
                    null
            );
        }

        private static DeviceMetadataUpdate fromRequest(UpdateDeviceMetadataRequestDto requestDto) {
            return new DeviceMetadataUpdate(
                    StringNormalizer.trimToNull(requestDto.deviceName()),
                    requestDto.platform(),
                    StringNormalizer.trimToNull(requestDto.clientVersion()),
                    StringNormalizer.trimToNull(requestDto.osName()),
                    StringNormalizer.trimToNull(requestDto.osVersion()),
                    StringNormalizer.trimToNull(requestDto.architecture()),
                    StringNormalizer.trimToNull(requestDto.hostname()),
                    StringNormalizer.normalizeFingerprint(requestDto.deviceFingerprint())
            );
        }
    }
}

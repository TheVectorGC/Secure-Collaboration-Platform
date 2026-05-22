package dev.identityservice.service.impl;

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
import dev.identityservice.model.enumeration.DeviceStatus;
import dev.identityservice.repository.AccountRepository;
import dev.identityservice.repository.AuthSessionRepository;
import dev.identityservice.repository.DeviceRepository;
import dev.identityservice.service.DeviceService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
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

    @Override
    @Transactional
    public DeviceEntity resolveLoginDevice(AccountEntity accountEntity, LoginRequestDto loginRequestDto) {
        String clientInstallationId = trimToNull(loginRequestDto.clientInstallationId());

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
        AccountEntity accountEntity = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AccountNotFoundException("Account with username '" + username + "' not found."));

        return deviceRepository.findByAccountId(accountEntity.getId()).stream()
                .map(this::mapToDeviceResponseDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ActiveDeviceResponseDto> getActiveAccountDevices(UUID accountId) {
        return deviceRepository.findByAccountIdAndStatus(accountId, DeviceStatus.ACTIVE).stream()
                .map(this::mapToActiveDeviceResponseDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public InternalDeviceResponseDto getInternalDevice(UUID deviceId) {
        DeviceEntity deviceEntity = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new DeviceNotFoundException("Device with ID '" + deviceId + "' not found."));

        return mapToInternalDeviceResponseDto(deviceEntity);
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

        if (deviceEntity.getStatus() == DeviceStatus.REVOKED) {
            throw new DeviceRevokedException("Device has been revoked.");
        }

        applyMetadataUpdate(deviceEntity, requestDto);
        deviceEntity.setLastSeenAt(OffsetDateTime.now());
        deviceEntity.setUpdatedAt(OffsetDateTime.now());

        return mapToDeviceResponseDto(deviceRepository.save(deviceEntity));
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

        OffsetDateTime now = OffsetDateTime.now();
        deviceEntity.setStatus(DeviceStatus.REVOKED);
        deviceEntity.setUpdatedAt(now);
        deviceRepository.save(deviceEntity);
        revokeDeviceSessions(deviceId);
        log.info("Device revoked successfully. Device ID: {}, account ID: {}.", deviceId, accountEntity.getId());
    }

    @Override
    @Transactional
    public void revokeDeviceSessions(UUID deviceId) {
        List<AuthSessionEntity> activeSessions = authSessionRepository.findByDeviceIdAndStatus(
                deviceId,
                AuthSessionStatus.ACTIVE
        );

        activeSessions.forEach(authSessionEntity -> authSessionEntity.setStatus(AuthSessionStatus.REVOKED));
        authSessionRepository.saveAll(activeSessions);
    }

    private DeviceEntity resolveDeviceByClientInstallation(
            AccountEntity accountEntity,
            LoginRequestDto loginRequestDto,
            String clientInstallationId
    ) {
        return deviceRepository.findByAccountIdAndClientInstallationId(accountEntity.getId(), clientInstallationId)
                .map(deviceEntity -> refreshInstallationBoundDevice(deviceEntity, loginRequestDto))
                .orElseGet(() -> createDevice(accountEntity, loginRequestDto, clientInstallationId));
    }

    private DeviceEntity resolveExistingDevice(
            AccountEntity accountEntity,
            LoginRequestDto loginRequestDto,
            String clientInstallationId
    ) {
        DeviceEntity deviceEntity = deviceRepository.findByIdAndAccountId(
                        loginRequestDto.deviceId(),
                        accountEntity.getId()
                )
                .orElseThrow(() -> new DeviceNotFoundException("Device with ID '" + loginRequestDto.deviceId() + "' not found."));

        if (deviceEntity.getStatus() == DeviceStatus.REVOKED) {
            throw new DeviceRevokedException("Device has been revoked.");
        }

        if (clientInstallationId != null) {
            bindDeviceToClientInstallation(accountEntity.getId(), deviceEntity, clientInstallationId);
        }

        OffsetDateTime now = OffsetDateTime.now();
        deviceEntity.setLastSeenAt(now);
        deviceEntity.setUpdatedAt(now);
        applyMutableLoginDeviceMetadata(deviceEntity, loginRequestDto);

        return deviceRepository.save(deviceEntity);
    }

    private DeviceEntity refreshInstallationBoundDevice(DeviceEntity deviceEntity, LoginRequestDto loginRequestDto) {
        if (deviceEntity.getStatus() == DeviceStatus.REVOKED) {
            throw new DeviceRevokedException("Device has been revoked.");
        }

        OffsetDateTime now = OffsetDateTime.now();
        deviceEntity.setLastSeenAt(now);
        deviceEntity.setUpdatedAt(now);
        applyMutableLoginDeviceMetadata(deviceEntity, loginRequestDto);

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
            conflictingDeviceEntity.setStatus(DeviceStatus.REVOKED);
            revokeDeviceSessions(conflictingDeviceEntity.getId());
        }

        conflictingDeviceEntity.setClientInstallationId(null);
        conflictingDeviceEntity.setUpdatedAt(OffsetDateTime.now());
        deviceRepository.save(conflictingDeviceEntity);
        log.warn(
                "Detached duplicate client installation binding from device. Device ID: {}, account ID: {}.",
                conflictingDeviceEntity.getId(),
                conflictingDeviceEntity.getAccountId()
        );
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
                .clientVersion(trimToNull(loginRequestDto.clientVersion()))
                .osName(trimToNull(loginRequestDto.osName()))
                .osVersion(trimToNull(loginRequestDto.osVersion()))
                .architecture(trimToNull(loginRequestDto.architecture()))
                .hostname(trimToNull(loginRequestDto.hostname()))
                .lastSeenAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();

        DeviceEntity savedDeviceEntity = deviceRepository.save(deviceEntity);
        log.info(
                "Device registered successfully. Device ID: {}, account ID: {}.",
                savedDeviceEntity.getId(),
                accountEntity.getId()
        );

        return savedDeviceEntity;
    }

    private void validateNewDeviceRequest(LoginRequestDto loginRequestDto) {
        if (loginRequestDto.deviceName() == null || loginRequestDto.deviceName().trim().isEmpty()) {
            throw new DeviceRegistrationException("Device name is required for new device registration.");
        }

        if (loginRequestDto.platform() == null) {
            throw new DeviceRegistrationException("Device platform is required for new device registration.");
        }
    }

    private void applyMutableLoginDeviceMetadata(DeviceEntity deviceEntity, LoginRequestDto loginRequestDto) {
        String deviceName = trimToNull(loginRequestDto.deviceName());
        String clientVersion = trimToNull(loginRequestDto.clientVersion());
        String osName = trimToNull(loginRequestDto.osName());
        String osVersion = trimToNull(loginRequestDto.osVersion());
        String architecture = trimToNull(loginRequestDto.architecture());
        String hostname = trimToNull(loginRequestDto.hostname());

        if (deviceName != null) {
            deviceEntity.setDeviceName(deviceName);
        }

        if (loginRequestDto.platform() != null) {
            deviceEntity.setPlatform(loginRequestDto.platform());
        }

        if (clientVersion != null) {
            deviceEntity.setClientVersion(clientVersion);
        }

        if (osName != null) {
            deviceEntity.setOsName(osName);
        }

        if (osVersion != null) {
            deviceEntity.setOsVersion(osVersion);
        }

        if (architecture != null) {
            deviceEntity.setArchitecture(architecture);
        }

        if (hostname != null) {
            deviceEntity.setHostname(hostname);
        }
    }

    private void applyMetadataUpdate(DeviceEntity deviceEntity, UpdateDeviceMetadataRequestDto requestDto) {
        String deviceName = trimToNull(requestDto.deviceName());
        String clientVersion = trimToNull(requestDto.clientVersion());
        String osName = trimToNull(requestDto.osName());
        String osVersion = trimToNull(requestDto.osVersion());
        String architecture = trimToNull(requestDto.architecture());
        String hostname = trimToNull(requestDto.hostname());
        String deviceFingerprint = normalizeFingerprint(requestDto.deviceFingerprint());

        if (deviceName != null) {
            deviceEntity.setDeviceName(deviceName);
        }

        if (requestDto.platform() != null) {
            deviceEntity.setPlatform(requestDto.platform());
        }

        if (clientVersion != null) {
            deviceEntity.setClientVersion(clientVersion);
        }

        if (osName != null) {
            deviceEntity.setOsName(osName);
        }

        if (osVersion != null) {
            deviceEntity.setOsVersion(osVersion);
        }

        if (architecture != null) {
            deviceEntity.setArchitecture(architecture);
        }

        if (hostname != null) {
            deviceEntity.setHostname(hostname);
        }

        if (deviceFingerprint != null) {
            deviceEntity.setDeviceFingerprint(deviceFingerprint);
        }
    }

    private AccountEntity findAccountByUsername(String username) {
        return accountRepository.findByUsername(username)
                .orElseThrow(() -> new AccountNotFoundException("Account with username '" + username + "' not found."));
    }

    private DeviceEntity findCurrentAccountDevice(AccountEntity accountEntity, UUID deviceId) {
        return deviceRepository.findByIdAndAccountId(deviceId, accountEntity.getId())
                .orElseThrow(() -> new DeviceNotFoundException("Device with ID '" + deviceId + "' not found."));
    }

    private DeviceResponseDto mapToDeviceResponseDto(DeviceEntity deviceEntity) {
        return new DeviceResponseDto(
                deviceEntity.getId(),
                deviceEntity.getDeviceName(),
                deviceEntity.getPlatform(),
                deviceEntity.getStatus(),
                deviceEntity.getClientVersion(),
                deviceEntity.getOsName(),
                deviceEntity.getOsVersion(),
                deviceEntity.getArchitecture(),
                deviceEntity.getHostname(),
                deviceEntity.getDeviceFingerprint(),
                deviceEntity.getLastSeenAt(),
                deviceEntity.getCreatedAt()
        );
    }

    private ActiveDeviceResponseDto mapToActiveDeviceResponseDto(DeviceEntity deviceEntity) {
        return new ActiveDeviceResponseDto(
                deviceEntity.getId(),
                deviceEntity.getAccountId(),
                deviceEntity.getDeviceName(),
                deviceEntity.getPlatform(),
                deviceEntity.getClientVersion(),
                deviceEntity.getOsName(),
                deviceEntity.getOsVersion(),
                deviceEntity.getArchitecture(),
                deviceEntity.getHostname(),
                deviceEntity.getDeviceFingerprint(),
                deviceEntity.getLastSeenAt()
        );
    }

    private InternalDeviceResponseDto mapToInternalDeviceResponseDto(DeviceEntity deviceEntity) {
        return new InternalDeviceResponseDto(
                deviceEntity.getId(),
                deviceEntity.getAccountId(),
                deviceEntity.getStatus()
        );
    }

    private String normalizeFingerprint(String value) {
        String trimmedValue = trimToNull(value);

        if (trimmedValue == null) {
            return null;
        }

        return trimmedValue.replace(":", "").replace(" ", "").toUpperCase();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }

        String trimmedValue = value.trim();

        if (trimmedValue.isEmpty()) {
            return null;
        }

        return trimmedValue;
    }
}

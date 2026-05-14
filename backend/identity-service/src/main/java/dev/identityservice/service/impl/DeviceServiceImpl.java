package dev.identityservice.service.impl;

import dev.identityservice.exception.AccountNotFoundException;
import dev.identityservice.exception.DeviceNotFoundException;
import dev.identityservice.exception.DeviceRegistrationException;
import dev.identityservice.exception.DeviceRevokedException;
import dev.identityservice.model.dto.request.LoginRequestDto;
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
        if (loginRequestDto.deviceId() != null) {
            return resolveExistingDevice(accountEntity, loginRequestDto);
        }

        return createDevice(accountEntity, loginRequestDto);
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
    public InternalDeviceResponseDto getInternalDevice(UUID deviceId) {
        DeviceEntity deviceEntity = deviceRepository.findById(deviceId)
            .orElseThrow(() -> new DeviceNotFoundException("Device with ID '" + deviceId + "' not found."));

        return mapToInternalDeviceResponseDto(deviceEntity);
    }

    @Override
    @Transactional
    public void revokeCurrentAccountDevice(String username, UUID deviceId) {
        AccountEntity accountEntity = accountRepository.findByUsername(username)
            .orElseThrow(() -> new AccountNotFoundException("Account with username '" + username + "' not found."));

        DeviceEntity deviceEntity = deviceRepository.findByIdAndAccountId(deviceId, accountEntity.getId())
            .orElseThrow(() -> new DeviceNotFoundException("Device with ID '" + deviceId + "' not found."));

        if (deviceEntity.getStatus() == DeviceStatus.REVOKED) {
            log.info("Device is already revoked. Device ID: {}.", deviceId);
            return;
        }

        deviceEntity.setStatus(DeviceStatus.REVOKED);
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

    private DeviceEntity resolveExistingDevice(AccountEntity accountEntity, LoginRequestDto loginRequestDto) {
        DeviceEntity deviceEntity = deviceRepository.findByIdAndAccountId(
                loginRequestDto.deviceId(),
                accountEntity.getId()
            )
            .orElseThrow(() -> new DeviceNotFoundException("Device with ID '" + loginRequestDto.deviceId() + "' not found."));

        if (deviceEntity.getStatus() == DeviceStatus.REVOKED) {
            throw new DeviceRevokedException("Device has been revoked.");
        }

        OffsetDateTime now = OffsetDateTime.now();

        deviceEntity.setLastSeenAt(now);

        if (loginRequestDto.clientVersion() != null && !loginRequestDto.clientVersion().trim().isEmpty()) {
            deviceEntity.setClientVersion(loginRequestDto.clientVersion().trim());
        }

        return deviceRepository.save(deviceEntity);
    }

    private DeviceEntity createDevice(AccountEntity accountEntity, LoginRequestDto loginRequestDto) {
        validateNewDeviceRequest(loginRequestDto);

        OffsetDateTime now = OffsetDateTime.now();

        DeviceEntity deviceEntity = DeviceEntity.builder()
            .accountId(accountEntity.getId())
            .deviceName(loginRequestDto.deviceName().trim())
            .platform(loginRequestDto.platform())
            .status(DeviceStatus.ACTIVE)
            .clientVersion(trimToNull(loginRequestDto.clientVersion()))
            .lastSeenAt(now)
            .createdAt(now)
            .build();

        DeviceEntity savedDeviceEntity = deviceRepository.save(deviceEntity);

        log.info("Device registered successfully. Device ID: {}, account ID: {}.", savedDeviceEntity.getId(), accountEntity.getId());

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

    private DeviceResponseDto mapToDeviceResponseDto(DeviceEntity deviceEntity) {
        return new DeviceResponseDto(
            deviceEntity.getId(),
            deviceEntity.getDeviceName(),
            deviceEntity.getPlatform(),
            deviceEntity.getStatus(),
            deviceEntity.getClientVersion(),
            deviceEntity.getLastSeenAt(),
            deviceEntity.getCreatedAt()
        );
    }

    private InternalDeviceResponseDto mapToInternalDeviceResponseDto(DeviceEntity deviceEntity) {
        return new InternalDeviceResponseDto(
            deviceEntity.getId(),
            deviceEntity.getAccountId(),
            deviceEntity.getStatus()
        );
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

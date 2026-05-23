package dev.cryptoservice.service.impl;

import dev.cryptoservice.config.PreKeyProperties;
import dev.cryptoservice.mapper.CryptoKeyMapper;
import dev.cryptoservice.model.dto.request.RegisterIdentityKeyRequestDto;
import dev.cryptoservice.model.dto.request.UploadKyberPreKeyRequestDto;
import dev.cryptoservice.model.dto.request.UploadOneTimePreKeysRequestDto;
import dev.cryptoservice.model.dto.request.UploadSignedPreKeyRequestDto;
import dev.cryptoservice.model.dto.response.IdentityKeyResponseDto;
import dev.cryptoservice.model.dto.response.OneTimePreKeyResponseDto;
import dev.cryptoservice.model.dto.response.PreKeyBundleResponseDto;
import dev.cryptoservice.model.dto.response.PreKeyStatusResponseDto;
import dev.cryptoservice.model.entity.DeviceIdentityKeyEntity;
import dev.cryptoservice.model.entity.DeviceKyberPreKeyEntity;
import dev.cryptoservice.model.entity.DeviceSignedPreKeyEntity;
import dev.cryptoservice.service.CryptoKeyService;
import dev.cryptoservice.service.DeviceAccessValidator;
import dev.cryptoservice.service.internal.IdentityKeyRegistryService;
import dev.cryptoservice.service.internal.KyberPreKeyRegistryService;
import dev.cryptoservice.service.internal.OneTimePreKeyRegistryService;
import dev.cryptoservice.service.internal.SignedPreKeyRegistryService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CryptoKeyServiceImpl implements CryptoKeyService {
    private final DeviceAccessValidator deviceAccessValidator;
    private final CryptoKeyMapper cryptoKeyMapper;
    private final PreKeyProperties preKeyProperties;
    private final IdentityKeyRegistryService identityKeyRegistryService;
    private final SignedPreKeyRegistryService signedPreKeyRegistryService;
    private final KyberPreKeyRegistryService kyberPreKeyRegistryService;
    private final OneTimePreKeyRegistryService oneTimePreKeyRegistryService;

    @Override
    @Transactional
    public IdentityKeyResponseDto registerIdentityKey(UUID accountId, UUID deviceId, RegisterIdentityKeyRequestDto requestDto) {
        log.info("Registering device identity key. accountId={}, deviceId={}", accountId, deviceId);
        deviceAccessValidator.validateDeviceOwner(accountId, deviceId);
        DeviceIdentityKeyEntity entity = identityKeyRegistryService.registerIdentityKey(deviceId, requestDto);
        log.info("Device identity key registered. accountId={}, deviceId={}", accountId, deviceId);
        return cryptoKeyMapper.toIdentityKeyResponse(entity);
    }

    @Override
    @Transactional
    public void uploadSignedPreKey(UUID accountId, UUID deviceId, UploadSignedPreKeyRequestDto requestDto) {
        log.info("Uploading signed prekey. accountId={}, deviceId={}, keyId={}", accountId, deviceId, requestDto.keyId());
        deviceAccessValidator.validateDeviceOwner(accountId, deviceId);
        DeviceIdentityKeyEntity identityKeyEntity = identityKeyRegistryService.getRequiredIdentityKey(deviceId);
        signedPreKeyRegistryService.uploadSignedPreKey(deviceId, identityKeyEntity, requestDto);
        log.info("Signed prekey uploaded. accountId={}, deviceId={}, keyId={}", accountId, deviceId, requestDto.keyId());
    }

    @Override
    @Transactional
    public void uploadKyberPreKey(UUID accountId, UUID deviceId, UploadKyberPreKeyRequestDto requestDto) {
        log.info("Uploading Kyber prekey. accountId={}, deviceId={}, keyId={}", accountId, deviceId, requestDto.keyId());
        deviceAccessValidator.validateDeviceOwner(accountId, deviceId);
        DeviceIdentityKeyEntity identityKeyEntity = identityKeyRegistryService.getRequiredIdentityKey(deviceId);
        kyberPreKeyRegistryService.uploadKyberPreKey(deviceId, identityKeyEntity, requestDto);
        log.info("Kyber prekey uploaded. accountId={}, deviceId={}, keyId={}", accountId, deviceId, requestDto.keyId());
    }

    @Override
    @Transactional
    public void uploadOneTimePreKeys(UUID accountId, UUID deviceId, UploadOneTimePreKeysRequestDto requestDto) {
        log.info("Uploading one-time prekeys. accountId={}, deviceId={}, count={}", accountId, deviceId, requestDto.preKeys().size());
        deviceAccessValidator.validateDeviceOwner(accountId, deviceId);
        oneTimePreKeyRegistryService.uploadOneTimePreKeys(deviceId, requestDto);
        log.info("One-time prekeys uploaded. accountId={}, deviceId={}, count={}", accountId, deviceId, requestDto.preKeys().size());
    }

    @Override
    @Transactional
    public PreKeyBundleResponseDto getPreKeyBundle(UUID targetDeviceId) {
        log.info("Fetching prekey bundle. targetDeviceId={}", targetDeviceId);
        deviceAccessValidator.validateDeviceActive(targetDeviceId);

        DeviceIdentityKeyEntity identityKeyEntity = identityKeyRegistryService.getRequiredIdentityKey(targetDeviceId);
        DeviceSignedPreKeyEntity signedPreKeyEntity = signedPreKeyRegistryService.getActiveSignedPreKey(targetDeviceId);
        DeviceKyberPreKeyEntity kyberPreKeyEntity = kyberPreKeyRegistryService.getActiveKyberPreKey(targetDeviceId);
        OneTimePreKeyResponseDto oneTimePreKeyResponseDto = oneTimePreKeyRegistryService.consumeOneTimePreKeyIfAvailable(targetDeviceId);

        log.debug("Prekey bundle prepared. targetDeviceId={}, oneTimePreKeyIncluded={}", targetDeviceId, oneTimePreKeyResponseDto != null);

        return new PreKeyBundleResponseDto(
            targetDeviceId,
            identityKeyEntity.getRegistrationId(),
            cryptoKeyMapper.toIdentityKeyResponse(identityKeyEntity),
            cryptoKeyMapper.toSignedPreKeyResponse(signedPreKeyEntity),
            cryptoKeyMapper.toKyberPreKeyResponse(kyberPreKeyEntity),
            oneTimePreKeyResponseDto
        );
    }

    @Override
    @Transactional(readOnly = true)
    public PreKeyStatusResponseDto getPreKeyStatus(UUID accountId, UUID deviceId) {
        deviceAccessValidator.validateDeviceOwner(accountId, deviceId);
        boolean identityKeyRegistered = identityKeyRegistryService.isRegistered(deviceId);
        boolean activeSignedPreKeyRegistered = signedPreKeyRegistryService.hasActiveSignedPreKey(deviceId);
        boolean activeKyberPreKeyRegistered = kyberPreKeyRegistryService.hasActiveKyberPreKey(deviceId);
        long availableOneTimePreKeyCount = oneTimePreKeyRegistryService.countAvailableOneTimePreKeys(deviceId);

        return new PreKeyStatusResponseDto(
            deviceId,
            identityKeyRegistered,
            activeSignedPreKeyRegistered,
            activeKyberPreKeyRegistered,
            availableOneTimePreKeyCount,
            availableOneTimePreKeyCount <= preKeyProperties.lowThreshold()
        );
    }
}

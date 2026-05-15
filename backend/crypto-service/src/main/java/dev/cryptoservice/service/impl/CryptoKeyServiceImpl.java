package dev.cryptoservice.service.impl;

import dev.cryptoservice.config.PreKeyProperties;
import dev.cryptoservice.exception.DeviceIdentityKeyAlreadyExistsException;
import dev.cryptoservice.exception.DeviceIdentityKeyNotFoundException;
import dev.cryptoservice.exception.KyberPreKeyAlreadyExistsException;
import dev.cryptoservice.exception.KyberPreKeyNotFoundException;
import dev.cryptoservice.exception.KyberPreKeySignatureInvalidException;
import dev.cryptoservice.exception.OneTimePreKeyAlreadyExistsException;
import dev.cryptoservice.exception.SignedPreKeyAlreadyExistsException;
import dev.cryptoservice.exception.SignedPreKeyNotFoundException;
import dev.cryptoservice.exception.SignedPreKeySignatureInvalidException;
import dev.cryptoservice.model.dto.request.OneTimePreKeyRequestDto;
import dev.cryptoservice.model.dto.request.RegisterIdentityKeyRequestDto;
import dev.cryptoservice.model.dto.request.UploadKyberPreKeyRequestDto;
import dev.cryptoservice.model.dto.request.UploadOneTimePreKeysRequestDto;
import dev.cryptoservice.model.dto.request.UploadSignedPreKeyRequestDto;
import dev.cryptoservice.model.dto.response.IdentityKeyResponseDto;
import dev.cryptoservice.model.dto.response.KyberPreKeyResponseDto;
import dev.cryptoservice.model.dto.response.OneTimePreKeyResponseDto;
import dev.cryptoservice.model.dto.response.PreKeyBundleResponseDto;
import dev.cryptoservice.model.dto.response.PreKeyStatusResponseDto;
import dev.cryptoservice.model.dto.response.SignedPreKeyResponseDto;
import dev.cryptoservice.model.entity.DeviceIdentityKeyEntity;
import dev.cryptoservice.model.entity.DeviceKyberPreKeyEntity;
import dev.cryptoservice.model.entity.DeviceOneTimePreKeyEntity;
import dev.cryptoservice.model.entity.DeviceSignedPreKeyEntity;
import dev.cryptoservice.model.enumeration.KyberPreKeyStatus;
import dev.cryptoservice.model.enumeration.OneTimePreKeyStatus;
import dev.cryptoservice.model.enumeration.SignedPreKeyStatus;
import dev.cryptoservice.provider.CryptoProvider;
import dev.cryptoservice.repository.DeviceIdentityKeyRepository;
import dev.cryptoservice.repository.DeviceKyberPreKeyRepository;
import dev.cryptoservice.repository.DeviceOneTimePreKeyRepository;
import dev.cryptoservice.repository.DeviceSignedPreKeyRepository;
import dev.cryptoservice.service.CryptoKeyService;
import dev.cryptoservice.service.DeviceAccessValidator;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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
    private final CryptoProvider cryptoProvider;
    private final PreKeyProperties preKeyProperties;
    private final DeviceIdentityKeyRepository deviceIdentityKeyRepository;
    private final DeviceSignedPreKeyRepository deviceSignedPreKeyRepository;
    private final DeviceKyberPreKeyRepository deviceKyberPreKeyRepository;
    private final DeviceOneTimePreKeyRepository deviceOneTimePreKeyRepository;

    @Override
    @Transactional
    public IdentityKeyResponseDto registerIdentityKey(
        UUID accountId,
        UUID deviceId,
        RegisterIdentityKeyRequestDto registerIdentityKeyRequestDto
    ) {
        log.info("Registering identity key for device ID: {}.", deviceId);

        deviceAccessValidator.validateDeviceOwner(accountId, deviceId);

        if (deviceIdentityKeyRepository.existsById(deviceId)) {
            throw new DeviceIdentityKeyAlreadyExistsException("Identity key for device '" + deviceId + "' already exists.");
        }

        cryptoProvider.validateIdentityPublicKey(registerIdentityKeyRequestDto.publicKey());
        String fingerprint = cryptoProvider.calculateFingerprint(registerIdentityKeyRequestDto.publicKey());

        if (deviceIdentityKeyRepository.existsByFingerprint(fingerprint)) {
            throw new DeviceIdentityKeyAlreadyExistsException("Identity key with the same fingerprint already exists.");
        }

        DeviceIdentityKeyEntity deviceIdentityKeyEntity = DeviceIdentityKeyEntity.builder()
            .deviceId(deviceId)
            .registrationId(registerIdentityKeyRequestDto.registrationId())
            .publicKey(registerIdentityKeyRequestDto.publicKey().trim())
            .fingerprint(fingerprint)
            .createdAt(OffsetDateTime.now())
            .build();

        DeviceIdentityKeyEntity savedDeviceIdentityKeyEntity = deviceIdentityKeyRepository.save(deviceIdentityKeyEntity);

        log.info("Identity key registered for device ID: {}.", deviceId);

        return mapToIdentityKeyResponseDto(savedDeviceIdentityKeyEntity);
    }

    @Override
    @Transactional
    public void uploadSignedPreKey(
        UUID accountId,
        UUID deviceId,
        UploadSignedPreKeyRequestDto uploadSignedPreKeyRequestDto
    ) {
        log.info("Uploading signed prekey for device ID: {}, key ID: {}.", deviceId, uploadSignedPreKeyRequestDto.keyId());

        deviceAccessValidator.validateDeviceOwner(accountId, deviceId);

        DeviceIdentityKeyEntity deviceIdentityKeyEntity = deviceIdentityKeyRepository.findById(deviceId)
            .orElseThrow(() -> new DeviceIdentityKeyNotFoundException("Identity key for device '" + deviceId + "' was not found."));

        if (deviceSignedPreKeyRepository.existsByDeviceIdAndKeyId(deviceId, uploadSignedPreKeyRequestDto.keyId())) {
            throw new SignedPreKeyAlreadyExistsException("Signed prekey with key ID '" + uploadSignedPreKeyRequestDto.keyId() + "' already exists.");
        }

        cryptoProvider.validateSignedPreKeyPublicKey(uploadSignedPreKeyRequestDto.publicKey());

        boolean signatureValid = cryptoProvider.verifySignedPreKeySignature(
            deviceIdentityKeyEntity.getPublicKey(),
            uploadSignedPreKeyRequestDto.publicKey(),
            uploadSignedPreKeyRequestDto.signature()
        );

        if (!signatureValid) {
            throw new SignedPreKeySignatureInvalidException("Signed prekey signature is invalid.");
        }

        replaceActiveSignedPreKeys(deviceId);

        DeviceSignedPreKeyEntity deviceSignedPreKeyEntity = DeviceSignedPreKeyEntity.builder()
            .deviceId(deviceId)
            .keyId(uploadSignedPreKeyRequestDto.keyId())
            .publicKey(uploadSignedPreKeyRequestDto.publicKey().trim())
            .signature(uploadSignedPreKeyRequestDto.signature().trim())
            .status(SignedPreKeyStatus.ACTIVE)
            .createdAt(OffsetDateTime.now())
            .expiresAt(uploadSignedPreKeyRequestDto.expiresAt())
            .build();

        deviceSignedPreKeyRepository.save(deviceSignedPreKeyEntity);

        log.info("Signed prekey uploaded for device ID: {}, key ID: {}.", deviceId, uploadSignedPreKeyRequestDto.keyId());
    }

    @Override
    @Transactional
    public void uploadKyberPreKey(
        UUID accountId,
        UUID deviceId,
        UploadKyberPreKeyRequestDto uploadKyberPreKeyRequestDto
    ) {
        log.info("Uploading Kyber prekey for device ID: {}, key ID: {}.", deviceId, uploadKyberPreKeyRequestDto.keyId());

        deviceAccessValidator.validateDeviceOwner(accountId, deviceId);

        DeviceIdentityKeyEntity deviceIdentityKeyEntity = deviceIdentityKeyRepository.findById(deviceId)
            .orElseThrow(() -> new DeviceIdentityKeyNotFoundException("Identity key for device '" + deviceId + "' was not found."));

        if (deviceKyberPreKeyRepository.existsByDeviceIdAndKeyId(deviceId, uploadKyberPreKeyRequestDto.keyId())) {
            throw new KyberPreKeyAlreadyExistsException("Kyber prekey with key ID '" + uploadKyberPreKeyRequestDto.keyId() + "' already exists.");
        }

        cryptoProvider.validateKyberPreKeyPublicKey(uploadKyberPreKeyRequestDto.publicKey());

        boolean signatureValid = cryptoProvider.verifyKyberPreKeySignature(
            deviceIdentityKeyEntity.getPublicKey(),
            uploadKyberPreKeyRequestDto.publicKey(),
            uploadKyberPreKeyRequestDto.signature()
        );

        if (!signatureValid) {
            throw new KyberPreKeySignatureInvalidException("Kyber prekey signature is invalid.");
        }

        replaceActiveKyberPreKeys(deviceId);

        DeviceKyberPreKeyEntity deviceKyberPreKeyEntity = DeviceKyberPreKeyEntity.builder()
            .deviceId(deviceId)
            .keyId(uploadKyberPreKeyRequestDto.keyId())
            .publicKey(uploadKyberPreKeyRequestDto.publicKey().trim())
            .signature(uploadKyberPreKeyRequestDto.signature().trim())
            .status(KyberPreKeyStatus.ACTIVE)
            .createdAt(OffsetDateTime.now())
            .expiresAt(uploadKyberPreKeyRequestDto.expiresAt())
            .build();

        deviceKyberPreKeyRepository.save(deviceKyberPreKeyEntity);

        log.info("Kyber prekey uploaded for device ID: {}, key ID: {}.", deviceId, uploadKyberPreKeyRequestDto.keyId());
    }

    @Override
    @Transactional
    public void uploadOneTimePreKeys(
        UUID accountId,
        UUID deviceId,
        UploadOneTimePreKeysRequestDto uploadOneTimePreKeysRequestDto
    ) {
        log.info("Uploading one-time prekeys for device ID: {}. Count: {}.", deviceId, uploadOneTimePreKeysRequestDto.preKeys().size());

        deviceAccessValidator.validateDeviceOwner(accountId, deviceId);
        validateOneTimePreKeyDuplicates(deviceId, uploadOneTimePreKeysRequestDto.preKeys());

        OffsetDateTime now = OffsetDateTime.now();

        List<DeviceOneTimePreKeyEntity> preKeyEntities = uploadOneTimePreKeysRequestDto.preKeys().stream()
            .map(oneTimePreKeyRequestDto -> buildOneTimePreKeyEntity(deviceId, oneTimePreKeyRequestDto, uploadOneTimePreKeysRequestDto.expiresAt(), now))
            .toList();

        deviceOneTimePreKeyRepository.saveAll(preKeyEntities);

        log.info("One-time prekeys uploaded for device ID: {}. Count: {}.", deviceId, preKeyEntities.size());
    }

    @Override
    @Transactional
    public PreKeyBundleResponseDto getPreKeyBundle(UUID targetDeviceId) {
        log.info("Fetching prekey bundle for device ID: {}.", targetDeviceId);

        deviceAccessValidator.validateDeviceActive(targetDeviceId);

        DeviceIdentityKeyEntity deviceIdentityKeyEntity = deviceIdentityKeyRepository.findById(targetDeviceId)
            .orElseThrow(() -> new DeviceIdentityKeyNotFoundException("Identity key for device '" + targetDeviceId + "' was not found."));

        DeviceSignedPreKeyEntity deviceSignedPreKeyEntity = deviceSignedPreKeyRepository
            .findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(targetDeviceId, SignedPreKeyStatus.ACTIVE)
            .orElseThrow(() -> new SignedPreKeyNotFoundException("Active signed prekey for device '" + targetDeviceId + "' was not found."));

        DeviceKyberPreKeyEntity deviceKyberPreKeyEntity = deviceKyberPreKeyRepository
            .findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(targetDeviceId, KyberPreKeyStatus.ACTIVE)
            .orElseThrow(() -> new KyberPreKeyNotFoundException("Active Kyber prekey for device '" + targetDeviceId + "' was not found."));

        OneTimePreKeyResponseDto oneTimePreKeyResponseDto = consumeOneTimePreKeyIfAvailable(targetDeviceId);

        return new PreKeyBundleResponseDto(
            targetDeviceId,
            deviceIdentityKeyEntity.getRegistrationId(),
            mapToIdentityKeyResponseDto(deviceIdentityKeyEntity),
            mapToSignedPreKeyResponseDto(deviceSignedPreKeyEntity),
            mapToKyberPreKeyResponseDto(deviceKyberPreKeyEntity),
            oneTimePreKeyResponseDto
        );
    }

    @Override
    @Transactional(readOnly = true)
    public PreKeyStatusResponseDto getPreKeyStatus(UUID accountId, UUID deviceId) {
        deviceAccessValidator.validateDeviceOwner(accountId, deviceId);

        boolean identityKeyRegistered = deviceIdentityKeyRepository.existsById(deviceId);
        boolean activeSignedPreKeyRegistered = deviceSignedPreKeyRepository
            .findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(deviceId, SignedPreKeyStatus.ACTIVE)
            .isPresent();
        boolean activeKyberPreKeyRegistered = deviceKyberPreKeyRepository
            .findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(deviceId, KyberPreKeyStatus.ACTIVE)
            .isPresent();
        long availableOneTimePreKeyCount = deviceOneTimePreKeyRepository.countByDeviceIdAndStatus(deviceId, OneTimePreKeyStatus.AVAILABLE);

        return new PreKeyStatusResponseDto(
            deviceId,
            identityKeyRegistered,
            activeSignedPreKeyRegistered,
            activeKyberPreKeyRegistered,
            availableOneTimePreKeyCount,
            availableOneTimePreKeyCount <= preKeyProperties.lowThreshold()
        );
    }

    private void replaceActiveSignedPreKeys(UUID deviceId) {
        List<DeviceSignedPreKeyEntity> activeSignedPreKeys = deviceSignedPreKeyRepository.findByDeviceIdAndStatus(
            deviceId,
            SignedPreKeyStatus.ACTIVE
        );

        activeSignedPreKeys.forEach(deviceSignedPreKeyEntity -> deviceSignedPreKeyEntity.setStatus(SignedPreKeyStatus.REPLACED));
        deviceSignedPreKeyRepository.saveAll(activeSignedPreKeys);
    }

    private void replaceActiveKyberPreKeys(UUID deviceId) {
        List<DeviceKyberPreKeyEntity> activeKyberPreKeys = deviceKyberPreKeyRepository.findByDeviceIdAndStatus(
            deviceId,
            KyberPreKeyStatus.ACTIVE
        );

        activeKyberPreKeys.forEach(deviceKyberPreKeyEntity -> deviceKyberPreKeyEntity.setStatus(KyberPreKeyStatus.REPLACED));
        deviceKyberPreKeyRepository.saveAll(activeKyberPreKeys);
    }

    private void validateOneTimePreKeyDuplicates(UUID deviceId, List<OneTimePreKeyRequestDto> preKeys) {
        Set<Integer> keyIds = new HashSet<>();

        for (OneTimePreKeyRequestDto oneTimePreKeyRequestDto : preKeys) {
            if (!keyIds.add(oneTimePreKeyRequestDto.keyId())) {
                throw new OneTimePreKeyAlreadyExistsException("Duplicate one-time prekey ID in request: " + oneTimePreKeyRequestDto.keyId() + ".");
            }

            if (deviceOneTimePreKeyRepository.existsByDeviceIdAndKeyId(deviceId, oneTimePreKeyRequestDto.keyId())) {
                throw new OneTimePreKeyAlreadyExistsException("One-time prekey with key ID '" + oneTimePreKeyRequestDto.keyId() + "' already exists.");
            }
        }
    }

    private DeviceOneTimePreKeyEntity buildOneTimePreKeyEntity(
        UUID deviceId,
        OneTimePreKeyRequestDto oneTimePreKeyRequestDto,
        OffsetDateTime expiresAt,
        OffsetDateTime now
    ) {
        cryptoProvider.validateOneTimePreKeyPublicKey(oneTimePreKeyRequestDto.publicKey());
        String fingerprint = cryptoProvider.calculateFingerprint(oneTimePreKeyRequestDto.publicKey());

        return DeviceOneTimePreKeyEntity.builder()
            .deviceId(deviceId)
            .keyId(oneTimePreKeyRequestDto.keyId())
            .publicKey(oneTimePreKeyRequestDto.publicKey().trim())
            .fingerprint(fingerprint)
            .status(OneTimePreKeyStatus.AVAILABLE)
            .createdAt(now)
            .expiresAt(expiresAt)
            .build();
    }

    private OneTimePreKeyResponseDto consumeOneTimePreKeyIfAvailable(UUID targetDeviceId) {
        return deviceOneTimePreKeyRepository.findFirstAvailableForUpdate(targetDeviceId)
            .map(deviceOneTimePreKeyEntity -> {
                deviceOneTimePreKeyEntity.setStatus(OneTimePreKeyStatus.CONSUMED);
                deviceOneTimePreKeyEntity.setConsumedAt(OffsetDateTime.now());
                deviceOneTimePreKeyRepository.save(deviceOneTimePreKeyEntity);

                long availableOneTimePreKeyCount = deviceOneTimePreKeyRepository.countByDeviceIdAndStatus(
                    targetDeviceId,
                    OneTimePreKeyStatus.AVAILABLE
                );

                if (availableOneTimePreKeyCount <= preKeyProperties.lowThreshold()) {
                    log.warn("Low one-time prekey count for device ID: {}. Available count: {}.", targetDeviceId, availableOneTimePreKeyCount);
                }

                return new OneTimePreKeyResponseDto(
                    deviceOneTimePreKeyEntity.getKeyId(),
                    deviceOneTimePreKeyEntity.getPublicKey()
                );
            })
            .orElse(null);
    }

    private IdentityKeyResponseDto mapToIdentityKeyResponseDto(DeviceIdentityKeyEntity deviceIdentityKeyEntity) {
        return new IdentityKeyResponseDto(
            deviceIdentityKeyEntity.getPublicKey(),
            deviceIdentityKeyEntity.getFingerprint(),
            deviceIdentityKeyEntity.getCreatedAt()
        );
    }

    private SignedPreKeyResponseDto mapToSignedPreKeyResponseDto(DeviceSignedPreKeyEntity deviceSignedPreKeyEntity) {
        return new SignedPreKeyResponseDto(
            deviceSignedPreKeyEntity.getKeyId(),
            deviceSignedPreKeyEntity.getPublicKey(),
            deviceSignedPreKeyEntity.getSignature()
        );
    }

    private KyberPreKeyResponseDto mapToKyberPreKeyResponseDto(DeviceKyberPreKeyEntity deviceKyberPreKeyEntity) {
        return new KyberPreKeyResponseDto(
            deviceKyberPreKeyEntity.getKeyId(),
            deviceKyberPreKeyEntity.getPublicKey(),
            deviceKyberPreKeyEntity.getSignature()
        );
    }
}

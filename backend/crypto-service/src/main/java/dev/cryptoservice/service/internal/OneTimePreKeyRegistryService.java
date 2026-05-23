package dev.cryptoservice.service.internal;

import dev.cryptoservice.config.PreKeyProperties;
import dev.cryptoservice.exception.OneTimePreKeyAlreadyExistsException;
import dev.cryptoservice.mapper.CryptoKeyMapper;
import dev.cryptoservice.model.dto.request.OneTimePreKeyRequestDto;
import dev.cryptoservice.model.dto.request.UploadOneTimePreKeysRequestDto;
import dev.cryptoservice.model.dto.response.OneTimePreKeyResponseDto;
import dev.cryptoservice.model.entity.DeviceOneTimePreKeyEntity;
import dev.cryptoservice.model.enumeration.OneTimePreKeyStatus;
import dev.cryptoservice.provider.CryptoProvider;
import dev.cryptoservice.repository.DeviceOneTimePreKeyRepository;
import dev.cryptoservice.util.TextNormalizer;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class OneTimePreKeyRegistryService {
    private final CryptoProvider cryptoProvider;
    private final CryptoKeyMapper cryptoKeyMapper;
    private final PreKeyProperties preKeyProperties;
    private final DeviceOneTimePreKeyRepository deviceOneTimePreKeyRepository;

    public void uploadOneTimePreKeys(UUID deviceId, UploadOneTimePreKeysRequestDto requestDto) {
        validateRequestDuplicates(deviceId, requestDto.preKeys());

        OffsetDateTime now = OffsetDateTime.now();
        List<DeviceOneTimePreKeyEntity> entities = requestDto.preKeys().stream()
            .map(preKeyRequestDto -> buildEntity(deviceId, preKeyRequestDto, requestDto.expiresAt(), now))
            .toList();

        deviceOneTimePreKeyRepository.saveAll(entities);
    }

    public OneTimePreKeyResponseDto consumeOneTimePreKeyIfAvailable(UUID targetDeviceId) {
        return deviceOneTimePreKeyRepository.findFirstAvailableForUpdate(targetDeviceId)
            .map(entity -> {
                entity.setStatus(OneTimePreKeyStatus.CONSUMED);
                entity.setConsumedAt(OffsetDateTime.now());
                deviceOneTimePreKeyRepository.save(entity);
                warnIfLowStock(targetDeviceId);
                return cryptoKeyMapper.toOneTimePreKeyResponse(entity);
            })
            .orElse(null);
    }

    public long countAvailableOneTimePreKeys(UUID deviceId) {
        return deviceOneTimePreKeyRepository.countByDeviceIdAndStatus(deviceId, OneTimePreKeyStatus.AVAILABLE);
    }

    private void validateRequestDuplicates(UUID deviceId, List<OneTimePreKeyRequestDto> preKeys) {
        Set<Integer> keyIds = new HashSet<>();

        for (OneTimePreKeyRequestDto preKeyRequestDto : preKeys) {
            if (!keyIds.add(preKeyRequestDto.keyId())) {
                throw new OneTimePreKeyAlreadyExistsException("Duplicate one-time prekey ID in request: " + preKeyRequestDto.keyId() + ".");
            }

            if (deviceOneTimePreKeyRepository.existsByDeviceIdAndKeyId(deviceId, preKeyRequestDto.keyId())) {
                throw new OneTimePreKeyAlreadyExistsException("One-time prekey with key ID '" + preKeyRequestDto.keyId() + "' already exists.");
            }
        }
    }

    private DeviceOneTimePreKeyEntity buildEntity(UUID deviceId, OneTimePreKeyRequestDto requestDto, OffsetDateTime expiresAt, OffsetDateTime now) {
        String publicKey = TextNormalizer.trimRequired(requestDto.publicKey());
        cryptoProvider.validateOneTimePreKeyPublicKey(publicKey);
        String fingerprint = cryptoProvider.calculateFingerprint(publicKey);

        return DeviceOneTimePreKeyEntity.builder()
            .deviceId(deviceId)
            .keyId(requestDto.keyId())
            .publicKey(publicKey)
            .fingerprint(fingerprint)
            .status(OneTimePreKeyStatus.AVAILABLE)
            .createdAt(now)
            .expiresAt(expiresAt)
            .build();
    }

    private void warnIfLowStock(UUID deviceId) {
        long availableOneTimePreKeyCount = countAvailableOneTimePreKeys(deviceId);

        if (availableOneTimePreKeyCount <= preKeyProperties.lowThreshold()) {
            log.warn("One-time prekey stock is low. deviceId={}, availableCount={}", deviceId, availableOneTimePreKeyCount);
        }
    }
}

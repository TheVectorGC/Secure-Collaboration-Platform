package dev.cryptoservice.service.internal;

import dev.cryptoservice.exception.KyberPreKeyAlreadyExistsException;
import dev.cryptoservice.exception.KyberPreKeyNotFoundException;
import dev.cryptoservice.exception.KyberPreKeySignatureInvalidException;
import dev.cryptoservice.model.dto.request.UploadKyberPreKeyRequestDto;
import dev.cryptoservice.model.entity.DeviceIdentityKeyEntity;
import dev.cryptoservice.model.entity.DeviceKyberPreKeyEntity;
import dev.cryptoservice.model.enumeration.KyberPreKeyStatus;
import dev.cryptoservice.provider.CryptoProvider;
import dev.cryptoservice.repository.DeviceKyberPreKeyRepository;
import dev.cryptoservice.util.TextNormalizer;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class KyberPreKeyRegistryService {
    private final CryptoProvider cryptoProvider;
    private final DeviceKyberPreKeyRepository deviceKyberPreKeyRepository;

    public void uploadKyberPreKey(UUID deviceId, DeviceIdentityKeyEntity identityKeyEntity, UploadKyberPreKeyRequestDto requestDto) {
        if (deviceKyberPreKeyRepository.existsByDeviceIdAndKeyId(deviceId, requestDto.keyId())) {
            throw new KyberPreKeyAlreadyExistsException("Kyber prekey with key ID '" + requestDto.keyId() + "' already exists.");
        }

        String publicKey = TextNormalizer.trimRequired(requestDto.publicKey());
        String signature = TextNormalizer.trimRequired(requestDto.signature());
        cryptoProvider.validateKyberPreKeyPublicKey(publicKey);

        boolean signatureValid = cryptoProvider.verifyKyberPreKeySignature(identityKeyEntity.getPublicKey(), publicKey, signature);

        if (!signatureValid) {
            throw new KyberPreKeySignatureInvalidException("Kyber prekey signature is invalid.");
        }

        replaceActiveKyberPreKeys(deviceId);

        DeviceKyberPreKeyEntity entity = DeviceKyberPreKeyEntity.builder()
            .deviceId(deviceId)
            .keyId(requestDto.keyId())
            .publicKey(publicKey)
            .signature(signature)
            .status(KyberPreKeyStatus.ACTIVE)
            .createdAt(OffsetDateTime.now())
            .expiresAt(requestDto.expiresAt())
            .build();

        deviceKyberPreKeyRepository.save(entity);
    }

    public DeviceKyberPreKeyEntity getActiveKyberPreKey(UUID deviceId) {
        return deviceKyberPreKeyRepository.findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(deviceId, KyberPreKeyStatus.ACTIVE)
            .orElseThrow(() -> new KyberPreKeyNotFoundException("Active Kyber prekey for device '" + deviceId + "' was not found."));
    }

    public boolean hasActiveKyberPreKey(UUID deviceId) {
        return deviceKyberPreKeyRepository.findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(deviceId, KyberPreKeyStatus.ACTIVE).isPresent();
    }

    private void replaceActiveKyberPreKeys(UUID deviceId) {
        List<DeviceKyberPreKeyEntity> activeKyberPreKeys = deviceKyberPreKeyRepository.findByDeviceIdAndStatus(deviceId, KyberPreKeyStatus.ACTIVE);
        activeKyberPreKeys.forEach(entity -> entity.setStatus(KyberPreKeyStatus.REPLACED));
        deviceKyberPreKeyRepository.saveAll(activeKyberPreKeys);
        log.debug("Replaced active Kyber prekeys. deviceId={}, count={}", deviceId, activeKyberPreKeys.size());
    }
}

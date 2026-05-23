package dev.cryptoservice.service.internal;

import dev.cryptoservice.exception.SignedPreKeyAlreadyExistsException;
import dev.cryptoservice.exception.SignedPreKeyNotFoundException;
import dev.cryptoservice.exception.SignedPreKeySignatureInvalidException;
import dev.cryptoservice.model.dto.request.UploadSignedPreKeyRequestDto;
import dev.cryptoservice.model.entity.DeviceIdentityKeyEntity;
import dev.cryptoservice.model.entity.DeviceSignedPreKeyEntity;
import dev.cryptoservice.model.enumeration.SignedPreKeyStatus;
import dev.cryptoservice.provider.CryptoProvider;
import dev.cryptoservice.repository.DeviceSignedPreKeyRepository;
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
public class SignedPreKeyRegistryService {
    private final CryptoProvider cryptoProvider;
    private final DeviceSignedPreKeyRepository deviceSignedPreKeyRepository;

    public void uploadSignedPreKey(UUID deviceId, DeviceIdentityKeyEntity identityKeyEntity, UploadSignedPreKeyRequestDto requestDto) {
        if (deviceSignedPreKeyRepository.existsByDeviceIdAndKeyId(deviceId, requestDto.keyId())) {
            throw new SignedPreKeyAlreadyExistsException("Signed prekey with key ID '" + requestDto.keyId() + "' already exists.");
        }

        String publicKey = TextNormalizer.trimRequired(requestDto.publicKey());
        String signature = TextNormalizer.trimRequired(requestDto.signature());
        cryptoProvider.validateSignedPreKeyPublicKey(publicKey);

        boolean signatureValid = cryptoProvider.verifySignedPreKeySignature(identityKeyEntity.getPublicKey(), publicKey, signature);

        if (!signatureValid) {
            throw new SignedPreKeySignatureInvalidException("Signed prekey signature is invalid.");
        }

        replaceActiveSignedPreKeys(deviceId);

        DeviceSignedPreKeyEntity entity = DeviceSignedPreKeyEntity.builder()
            .deviceId(deviceId)
            .keyId(requestDto.keyId())
            .publicKey(publicKey)
            .signature(signature)
            .status(SignedPreKeyStatus.ACTIVE)
            .createdAt(OffsetDateTime.now())
            .expiresAt(requestDto.expiresAt())
            .build();

        deviceSignedPreKeyRepository.save(entity);
    }

    public DeviceSignedPreKeyEntity getActiveSignedPreKey(UUID deviceId) {
        return deviceSignedPreKeyRepository.findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(deviceId, SignedPreKeyStatus.ACTIVE)
            .orElseThrow(() -> new SignedPreKeyNotFoundException("Active signed prekey for device '" + deviceId + "' was not found."));
    }

    public boolean hasActiveSignedPreKey(UUID deviceId) {
        return deviceSignedPreKeyRepository.findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(deviceId, SignedPreKeyStatus.ACTIVE).isPresent();
    }

    private void replaceActiveSignedPreKeys(UUID deviceId) {
        List<DeviceSignedPreKeyEntity> activeSignedPreKeys = deviceSignedPreKeyRepository.findByDeviceIdAndStatus(deviceId, SignedPreKeyStatus.ACTIVE);
        activeSignedPreKeys.forEach(entity -> entity.setStatus(SignedPreKeyStatus.REPLACED));
        deviceSignedPreKeyRepository.saveAll(activeSignedPreKeys);
        log.debug("Replaced active signed prekeys. deviceId={}, count={}", deviceId, activeSignedPreKeys.size());
    }
}

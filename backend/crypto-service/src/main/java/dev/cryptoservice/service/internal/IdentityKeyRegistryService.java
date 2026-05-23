package dev.cryptoservice.service.internal;

import dev.cryptoservice.exception.DeviceIdentityKeyAlreadyExistsException;
import dev.cryptoservice.exception.DeviceIdentityKeyNotFoundException;
import dev.cryptoservice.model.dto.request.RegisterIdentityKeyRequestDto;
import dev.cryptoservice.model.entity.DeviceIdentityKeyEntity;
import dev.cryptoservice.provider.CryptoProvider;
import dev.cryptoservice.repository.DeviceIdentityKeyRepository;
import dev.cryptoservice.util.TextNormalizer;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdentityKeyRegistryService {
    private final CryptoProvider cryptoProvider;
    private final DeviceIdentityKeyRepository deviceIdentityKeyRepository;

    public DeviceIdentityKeyEntity registerIdentityKey(UUID deviceId, RegisterIdentityKeyRequestDto requestDto) {
        if (deviceIdentityKeyRepository.existsById(deviceId)) {
            throw new DeviceIdentityKeyAlreadyExistsException("Identity key for device '" + deviceId + "' already exists.");
        }

        String publicKey = TextNormalizer.trimRequired(requestDto.publicKey());
        cryptoProvider.validateIdentityPublicKey(publicKey);
        String fingerprint = cryptoProvider.calculateFingerprint(publicKey);

        if (deviceIdentityKeyRepository.existsByFingerprint(fingerprint)) {
            throw new DeviceIdentityKeyAlreadyExistsException("Identity key with the same fingerprint already exists.");
        }

        DeviceIdentityKeyEntity entity = DeviceIdentityKeyEntity.builder()
            .deviceId(deviceId)
            .registrationId(requestDto.registrationId())
            .publicKey(publicKey)
            .fingerprint(fingerprint)
            .createdAt(OffsetDateTime.now())
            .build();

        log.debug("Saving device identity key. deviceId={}, fingerprint={}", deviceId, fingerprint);
        return deviceIdentityKeyRepository.save(entity);
    }

    public DeviceIdentityKeyEntity getRequiredIdentityKey(UUID deviceId) {
        return deviceIdentityKeyRepository.findById(deviceId)
            .orElseThrow(() -> new DeviceIdentityKeyNotFoundException("Identity key for device '" + deviceId + "' was not found."));
    }

    public boolean isRegistered(UUID deviceId) {
        return deviceIdentityKeyRepository.existsById(deviceId);
    }
}

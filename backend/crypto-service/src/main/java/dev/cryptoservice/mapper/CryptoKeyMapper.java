package dev.cryptoservice.mapper;

import dev.cryptoservice.model.dto.response.IdentityKeyResponseDto;
import dev.cryptoservice.model.dto.response.KyberPreKeyResponseDto;
import dev.cryptoservice.model.dto.response.OneTimePreKeyResponseDto;
import dev.cryptoservice.model.dto.response.SignedPreKeyResponseDto;
import dev.cryptoservice.model.entity.DeviceIdentityKeyEntity;
import dev.cryptoservice.model.entity.DeviceKyberPreKeyEntity;
import dev.cryptoservice.model.entity.DeviceOneTimePreKeyEntity;
import dev.cryptoservice.model.entity.DeviceSignedPreKeyEntity;
import org.springframework.stereotype.Component;

@Component
public class CryptoKeyMapper {
    public IdentityKeyResponseDto toIdentityKeyResponse(DeviceIdentityKeyEntity entity) {
        return new IdentityKeyResponseDto(entity.getPublicKey(), entity.getFingerprint(), entity.getCreatedAt());
    }

    public SignedPreKeyResponseDto toSignedPreKeyResponse(DeviceSignedPreKeyEntity entity) {
        return new SignedPreKeyResponseDto(entity.getKeyId(), entity.getPublicKey(), entity.getSignature());
    }

    public KyberPreKeyResponseDto toKyberPreKeyResponse(DeviceKyberPreKeyEntity entity) {
        return new KyberPreKeyResponseDto(entity.getKeyId(), entity.getPublicKey(), entity.getSignature());
    }

    public OneTimePreKeyResponseDto toOneTimePreKeyResponse(DeviceOneTimePreKeyEntity entity) {
        return new OneTimePreKeyResponseDto(entity.getKeyId(), entity.getPublicKey());
    }
}

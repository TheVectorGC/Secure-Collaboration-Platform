package dev.cryptoservice.mapper;

import dev.cryptoservice.model.dto.response.AccountBackupProfileResponseDto;
import dev.cryptoservice.model.dto.response.AccountBackupPublicKeyResponseDto;
import dev.cryptoservice.model.entity.AccountBackupProfileEntity;
import org.springframework.stereotype.Component;

@Component
public class AccountBackupProfileMapper {
    public AccountBackupProfileResponseDto toProfileResponse(AccountBackupProfileEntity entity) {
        return new AccountBackupProfileResponseDto(
            entity.getAccountId(),
            entity.getBackupPublicKeyBase64(),
            entity.getEncryptedBackupPrivateKeyBase64(),
            entity.getKdfAlgorithm(),
            entity.getKdfSaltBase64(),
            entity.getKdfParametersJson(),
            entity.getPrivateKeyEncryptionAlgorithm(),
            entity.getPrivateKeyInitializationVectorBase64(),
            entity.getPrivateKeyAuthenticationTagBase64(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }

    public AccountBackupPublicKeyResponseDto toPublicKeyResponse(AccountBackupProfileEntity entity) {
        return new AccountBackupPublicKeyResponseDto(entity.getAccountId(), entity.getBackupPublicKeyBase64());
    }
}

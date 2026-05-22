package dev.cryptoservice.service.impl;

import dev.cryptoservice.exception.AccountBackupProfileNotFoundException;
import dev.cryptoservice.exception.AccountBackupProfileConflictException;
import dev.cryptoservice.model.dto.request.UpsertAccountBackupProfileRequestDto;
import dev.cryptoservice.model.dto.response.AccountBackupProfileResponseDto;
import dev.cryptoservice.model.dto.response.AccountBackupPublicKeyResponseDto;
import dev.cryptoservice.model.entity.AccountBackupProfileEntity;
import dev.cryptoservice.repository.AccountBackupProfileRepository;
import dev.cryptoservice.service.AccountBackupProfileService;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AccountBackupProfileServiceImpl implements AccountBackupProfileService {
    private final AccountBackupProfileRepository accountBackupProfileRepository;

    @Override
    @Transactional(readOnly = true)
    public AccountBackupProfileResponseDto getCurrentProfile(UUID accountId) {
        AccountBackupProfileEntity entity = getProfileEntity(accountId);
        return mapToProfileResponseDto(entity);
    }

    @Override
    @Transactional
    public AccountBackupProfileResponseDto upsertCurrentProfile(UUID accountId, UpsertAccountBackupProfileRequestDto requestDto) {
        OffsetDateTime now = OffsetDateTime.now();
        AccountBackupProfileEntity existingEntity = accountBackupProfileRepository.findById(accountId).orElse(null);

        if (existingEntity != null) {
            String incomingPublicKey = requestDto.backupPublicKeyBase64().trim();

            if (!existingEntity.getBackupPublicKeyBase64().equals(incomingPublicKey)) {
                throw new AccountBackupProfileConflictException("Account backup public key is immutable for an existing profile.");
            }

            existingEntity.setEncryptedBackupPrivateKeyBase64(requestDto.encryptedBackupPrivateKeyBase64().trim());
            existingEntity.setKdfAlgorithm(requestDto.kdfAlgorithm().trim());
            existingEntity.setKdfSaltBase64(requestDto.kdfSaltBase64().trim());
            existingEntity.setKdfParametersJson(requestDto.kdfParametersJson().trim());
            existingEntity.setPrivateKeyEncryptionAlgorithm(requestDto.privateKeyEncryptionAlgorithm().trim());
            existingEntity.setPrivateKeyInitializationVectorBase64(requestDto.privateKeyInitializationVectorBase64().trim());
            existingEntity.setPrivateKeyAuthenticationTagBase64(requestDto.privateKeyAuthenticationTagBase64().trim());
            existingEntity.setUpdatedAt(now);

            return mapToProfileResponseDto(accountBackupProfileRepository.save(existingEntity));
        }

        AccountBackupProfileEntity entity = AccountBackupProfileEntity.builder()
                .accountId(accountId)
                .backupPublicKeyBase64(requestDto.backupPublicKeyBase64().trim())
                .encryptedBackupPrivateKeyBase64(requestDto.encryptedBackupPrivateKeyBase64().trim())
                .kdfAlgorithm(requestDto.kdfAlgorithm().trim())
                .kdfSaltBase64(requestDto.kdfSaltBase64().trim())
                .kdfParametersJson(requestDto.kdfParametersJson().trim())
                .privateKeyEncryptionAlgorithm(requestDto.privateKeyEncryptionAlgorithm().trim())
                .privateKeyInitializationVectorBase64(requestDto.privateKeyInitializationVectorBase64().trim())
                .privateKeyAuthenticationTagBase64(requestDto.privateKeyAuthenticationTagBase64().trim())
                .createdAt(now)
                .updatedAt(now)
                .build();

        return mapToProfileResponseDto(accountBackupProfileRepository.save(entity));
    }

    @Override
    @Transactional(readOnly = true)
    public AccountBackupPublicKeyResponseDto getPublicKey(UUID accountId) {
        AccountBackupProfileEntity entity = getProfileEntity(accountId);
        return new AccountBackupPublicKeyResponseDto(entity.getAccountId(), entity.getBackupPublicKeyBase64());
    }

    private AccountBackupProfileEntity getProfileEntity(UUID accountId) {
        return accountBackupProfileRepository.findById(accountId)
                .orElseThrow(() -> new AccountBackupProfileNotFoundException("Account backup profile for account ID '" + accountId + "' was not found."));
    }

    private AccountBackupProfileResponseDto mapToProfileResponseDto(AccountBackupProfileEntity entity) {
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
}

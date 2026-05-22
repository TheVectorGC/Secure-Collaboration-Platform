package dev.cryptoservice.service.impl;

import dev.cryptoservice.exception.AccountBackupProfileNotFoundException;
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
        AccountBackupProfileEntity entity = accountBackupProfileRepository.findById(accountId)
                .orElseGet(() -> AccountBackupProfileEntity.builder()
                        .accountId(accountId)
                        .createdAt(now)
                        .build());

        entity.setBackupPublicKeyBase64(requestDto.backupPublicKeyBase64().trim());
        entity.setEncryptedBackupPrivateKeyBase64(requestDto.encryptedBackupPrivateKeyBase64().trim());
        entity.setKdfAlgorithm(requestDto.kdfAlgorithm().trim());
        entity.setKdfSaltBase64(requestDto.kdfSaltBase64().trim());
        entity.setKdfParametersJson(requestDto.kdfParametersJson().trim());
        entity.setPrivateKeyEncryptionAlgorithm(requestDto.privateKeyEncryptionAlgorithm().trim());
        entity.setPrivateKeyInitializationVectorBase64(requestDto.privateKeyInitializationVectorBase64().trim());
        entity.setPrivateKeyAuthenticationTagBase64(requestDto.privateKeyAuthenticationTagBase64().trim());
        entity.setUpdatedAt(now);

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

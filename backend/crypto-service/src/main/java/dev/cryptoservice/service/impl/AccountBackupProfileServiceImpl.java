package dev.cryptoservice.service.impl;

import dev.cryptoservice.exception.AccountBackupProfileConflictException;
import dev.cryptoservice.exception.AccountBackupProfileNotFoundException;
import dev.cryptoservice.mapper.AccountBackupProfileMapper;
import dev.cryptoservice.model.dto.request.UpsertAccountBackupProfileRequestDto;
import dev.cryptoservice.model.dto.response.AccountBackupProfileResponseDto;
import dev.cryptoservice.model.dto.response.AccountBackupPublicKeyResponseDto;
import dev.cryptoservice.model.entity.AccountBackupProfileEntity;
import dev.cryptoservice.repository.AccountBackupProfileRepository;
import dev.cryptoservice.service.AccountBackupProfileService;
import dev.cryptoservice.util.TextNormalizer;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AccountBackupProfileServiceImpl implements AccountBackupProfileService {
    private final AccountBackupProfileMapper accountBackupProfileMapper;
    private final AccountBackupProfileRepository accountBackupProfileRepository;

    @Override
    @Transactional(readOnly = true)
    public AccountBackupProfileResponseDto getCurrentProfile(UUID accountId) {
        AccountBackupProfileEntity entity = getRequiredProfile(accountId);
        return accountBackupProfileMapper.toProfileResponse(entity);
    }

    @Override
    @Transactional
    public AccountBackupProfileResponseDto upsertCurrentProfile(UUID accountId, UpsertAccountBackupProfileRequestDto requestDto) {
        log.info("Upserting account backup profile. accountId={}", accountId);
        AccountBackupProfileEntity existingEntity = accountBackupProfileRepository.findById(accountId).orElse(null);
        AccountBackupProfileEntity savedEntity = existingEntity == null
            ? createProfile(accountId, requestDto)
            : updateProfile(existingEntity, requestDto);
        log.info("Account backup profile saved. accountId={}", accountId);
        return accountBackupProfileMapper.toProfileResponse(savedEntity);
    }

    @Override
    @Transactional(readOnly = true)
    public AccountBackupPublicKeyResponseDto getPublicKey(UUID accountId) {
        AccountBackupProfileEntity entity = getRequiredProfile(accountId);
        return accountBackupProfileMapper.toPublicKeyResponse(entity);
    }

    private AccountBackupProfileEntity createProfile(UUID accountId, UpsertAccountBackupProfileRequestDto requestDto) {
        OffsetDateTime now = OffsetDateTime.now();
        AccountBackupProfileEntity entity = AccountBackupProfileEntity.builder()
            .accountId(accountId)
            .backupPublicKeyBase64(TextNormalizer.trimRequired(requestDto.backupPublicKeyBase64()))
            .encryptedBackupPrivateKeyBase64(TextNormalizer.trimRequired(requestDto.encryptedBackupPrivateKeyBase64()))
            .kdfAlgorithm(TextNormalizer.trimRequired(requestDto.kdfAlgorithm()))
            .kdfSaltBase64(TextNormalizer.trimRequired(requestDto.kdfSaltBase64()))
            .kdfParametersJson(TextNormalizer.trimRequired(requestDto.kdfParametersJson()))
            .privateKeyEncryptionAlgorithm(TextNormalizer.trimRequired(requestDto.privateKeyEncryptionAlgorithm()))
            .privateKeyInitializationVectorBase64(TextNormalizer.trimRequired(requestDto.privateKeyInitializationVectorBase64()))
            .privateKeyAuthenticationTagBase64(TextNormalizer.trimRequired(requestDto.privateKeyAuthenticationTagBase64()))
            .createdAt(now)
            .updatedAt(now)
            .build();

        return accountBackupProfileRepository.save(entity);
    }

    private AccountBackupProfileEntity updateProfile(AccountBackupProfileEntity entity, UpsertAccountBackupProfileRequestDto requestDto) {
        String incomingPublicKey = TextNormalizer.trimRequired(requestDto.backupPublicKeyBase64());

        if (!entity.getBackupPublicKeyBase64().equals(incomingPublicKey)) {
            throw new AccountBackupProfileConflictException("Account backup public key is immutable for an existing profile.");
        }

        entity.setEncryptedBackupPrivateKeyBase64(TextNormalizer.trimRequired(requestDto.encryptedBackupPrivateKeyBase64()));
        entity.setKdfAlgorithm(TextNormalizer.trimRequired(requestDto.kdfAlgorithm()));
        entity.setKdfSaltBase64(TextNormalizer.trimRequired(requestDto.kdfSaltBase64()));
        entity.setKdfParametersJson(TextNormalizer.trimRequired(requestDto.kdfParametersJson()));
        entity.setPrivateKeyEncryptionAlgorithm(TextNormalizer.trimRequired(requestDto.privateKeyEncryptionAlgorithm()));
        entity.setPrivateKeyInitializationVectorBase64(TextNormalizer.trimRequired(requestDto.privateKeyInitializationVectorBase64()));
        entity.setPrivateKeyAuthenticationTagBase64(TextNormalizer.trimRequired(requestDto.privateKeyAuthenticationTagBase64()));
        entity.setUpdatedAt(OffsetDateTime.now());

        return accountBackupProfileRepository.save(entity);
    }

    private AccountBackupProfileEntity getRequiredProfile(UUID accountId) {
        return accountBackupProfileRepository.findById(accountId)
            .orElseThrow(() -> new AccountBackupProfileNotFoundException("Account backup profile for account ID '" + accountId + "' was not found."));
    }
}

package dev.cryptoservice.service.impl;

import dev.cryptoservice.exception.KeyBackupNotFoundException;
import dev.cryptoservice.model.dto.request.UpsertKeyBackupRequestDto;
import dev.cryptoservice.model.dto.response.KeyBackupResponseDto;
import dev.cryptoservice.model.dto.response.KeyBackupStatusResponseDto;
import dev.cryptoservice.model.entity.EncryptedKeyBackupEntity;
import dev.cryptoservice.repository.EncryptedKeyBackupRepository;
import dev.cryptoservice.service.KeyBackupService;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class KeyBackupServiceImpl implements KeyBackupService {
    private final EncryptedKeyBackupRepository encryptedKeyBackupRepository;

    @Override
    @Transactional(readOnly = true)
    public KeyBackupStatusResponseDto getStatus(UUID accountId) {
        return encryptedKeyBackupRepository.findById(accountId)
            .map(encryptedKeyBackupEntity -> new KeyBackupStatusResponseDto(
                true,
                encryptedKeyBackupEntity.getBackupVersion(),
                encryptedKeyBackupEntity.getCreatedAt(),
                encryptedKeyBackupEntity.getUpdatedAt()
            ))
            .orElseGet(() -> new KeyBackupStatusResponseDto(false, null, null, null));
    }

    @Override
    @Transactional(readOnly = true)
    public KeyBackupResponseDto getBackup(UUID accountId) {
        EncryptedKeyBackupEntity encryptedKeyBackupEntity = encryptedKeyBackupRepository.findById(accountId)
            .orElseThrow(() -> new KeyBackupNotFoundException("Encrypted key backup was not found for current account."));

        return toResponseDto(encryptedKeyBackupEntity);
    }

    @Override
    @Transactional
    public KeyBackupResponseDto upsertBackup(UUID accountId, UpsertKeyBackupRequestDto requestDto) {
        OffsetDateTime now = OffsetDateTime.now();
        EncryptedKeyBackupEntity encryptedKeyBackupEntity = encryptedKeyBackupRepository.findById(accountId)
            .map(existingBackup -> updateExistingBackup(existingBackup, requestDto, now))
            .orElseGet(() -> createNewBackup(accountId, requestDto, now));

        EncryptedKeyBackupEntity savedEncryptedKeyBackupEntity = encryptedKeyBackupRepository.save(encryptedKeyBackupEntity);
        log.info("Encrypted key backup saved. Account ID: {}, version: {}.", accountId, savedEncryptedKeyBackupEntity.getBackupVersion());
        return toResponseDto(savedEncryptedKeyBackupEntity);
    }

    private EncryptedKeyBackupEntity createNewBackup(UUID accountId, UpsertKeyBackupRequestDto requestDto, OffsetDateTime now) {
        return EncryptedKeyBackupEntity.builder()
            .accountId(accountId)
            .backupVersion(requestDto.backupVersion())
            .kdfAlgorithm(requestDto.kdfAlgorithm().trim())
            .kdfSaltBase64(requestDto.kdfSaltBase64().trim())
            .kdfParametersJson(requestDto.kdfParametersJson().trim())
            .encryptionAlgorithm(requestDto.encryptionAlgorithm().trim())
            .initializationVectorBase64(requestDto.initializationVectorBase64().trim())
            .authenticationTagBase64(requestDto.authenticationTagBase64().trim())
            .encryptedBackupBlobBase64(requestDto.encryptedBackupBlobBase64().trim())
            .createdAt(now)
            .updatedAt(now)
            .build();
    }

    private EncryptedKeyBackupEntity updateExistingBackup(
        EncryptedKeyBackupEntity encryptedKeyBackupEntity,
        UpsertKeyBackupRequestDto requestDto,
        OffsetDateTime now
    ) {
        encryptedKeyBackupEntity.setBackupVersion(requestDto.backupVersion());
        encryptedKeyBackupEntity.setKdfAlgorithm(requestDto.kdfAlgorithm().trim());
        encryptedKeyBackupEntity.setKdfSaltBase64(requestDto.kdfSaltBase64().trim());
        encryptedKeyBackupEntity.setKdfParametersJson(requestDto.kdfParametersJson().trim());
        encryptedKeyBackupEntity.setEncryptionAlgorithm(requestDto.encryptionAlgorithm().trim());
        encryptedKeyBackupEntity.setInitializationVectorBase64(requestDto.initializationVectorBase64().trim());
        encryptedKeyBackupEntity.setAuthenticationTagBase64(requestDto.authenticationTagBase64().trim());
        encryptedKeyBackupEntity.setEncryptedBackupBlobBase64(requestDto.encryptedBackupBlobBase64().trim());
        encryptedKeyBackupEntity.setUpdatedAt(now);
        return encryptedKeyBackupEntity;
    }

    private KeyBackupResponseDto toResponseDto(EncryptedKeyBackupEntity encryptedKeyBackupEntity) {
        return new KeyBackupResponseDto(
            encryptedKeyBackupEntity.getAccountId(),
            encryptedKeyBackupEntity.getBackupVersion(),
            encryptedKeyBackupEntity.getKdfAlgorithm(),
            encryptedKeyBackupEntity.getKdfSaltBase64(),
            encryptedKeyBackupEntity.getKdfParametersJson(),
            encryptedKeyBackupEntity.getEncryptionAlgorithm(),
            encryptedKeyBackupEntity.getInitializationVectorBase64(),
            encryptedKeyBackupEntity.getAuthenticationTagBase64(),
            encryptedKeyBackupEntity.getEncryptedBackupBlobBase64(),
            encryptedKeyBackupEntity.getCreatedAt(),
            encryptedKeyBackupEntity.getUpdatedAt()
        );
    }
}

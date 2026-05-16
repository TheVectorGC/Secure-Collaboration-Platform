package dev.cryptoservice.service;

import dev.cryptoservice.model.dto.request.UpsertKeyBackupRequestDto;
import dev.cryptoservice.model.dto.response.KeyBackupResponseDto;
import dev.cryptoservice.model.dto.response.KeyBackupStatusResponseDto;
import java.util.UUID;

public interface KeyBackupService {
    KeyBackupStatusResponseDto getStatus(UUID accountId);

    KeyBackupResponseDto getBackup(UUID accountId);

    KeyBackupResponseDto upsertBackup(UUID accountId, UpsertKeyBackupRequestDto requestDto);
}

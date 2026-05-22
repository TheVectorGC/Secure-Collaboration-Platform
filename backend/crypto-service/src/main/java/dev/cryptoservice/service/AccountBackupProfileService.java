package dev.cryptoservice.service;

import dev.cryptoservice.model.dto.request.UpsertAccountBackupProfileRequestDto;
import dev.cryptoservice.model.dto.response.AccountBackupProfileResponseDto;
import dev.cryptoservice.model.dto.response.AccountBackupPublicKeyResponseDto;
import java.util.UUID;

public interface AccountBackupProfileService {
    AccountBackupProfileResponseDto getCurrentProfile(UUID accountId);

    AccountBackupProfileResponseDto upsertCurrentProfile(UUID accountId, UpsertAccountBackupProfileRequestDto requestDto);

    AccountBackupPublicKeyResponseDto getPublicKey(UUID accountId);
}

package dev.cryptoservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Public account recovery key used to encrypt message key envelopes.")
public record AccountBackupPublicKeyResponseDto(
    UUID accountId,
    String backupPublicKeyBase64
) {}

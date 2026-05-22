package dev.cryptoservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Account-level history recovery key profile.")
public record AccountBackupProfileResponseDto(
    UUID accountId,
    String backupPublicKeyBase64,
    String encryptedBackupPrivateKeyBase64,
    String kdfAlgorithm,
    String kdfSaltBase64,
    String kdfParametersJson,
    String privateKeyEncryptionAlgorithm,
    String privateKeyInitializationVectorBase64,
    String privateKeyAuthenticationTagBase64,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}

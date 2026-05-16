package dev.cryptoservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Response DTO containing encrypted account key backup.")
public record KeyBackupResponseDto(
    @Schema(description = "Backup owner account ID.")
    UUID accountId,

    @Schema(description = "Client-side monotonically increasing backup version.")
    long backupVersion,

    @Schema(description = "Key derivation algorithm used by the client.")
    String kdfAlgorithm,

    @Schema(description = "Base64-encoded KDF salt.")
    String kdfSaltBase64,

    @Schema(description = "Client-side KDF parameters JSON.")
    String kdfParametersJson,

    @Schema(description = "Backup encryption algorithm.")
    String encryptionAlgorithm,

    @Schema(description = "Base64-encoded initialization vector.")
    String initializationVectorBase64,

    @Schema(description = "Base64-encoded authentication tag.")
    String authenticationTagBase64,

    @Schema(description = "Base64-encoded encrypted backup archive.")
    String encryptedBackupBlobBase64,

    @Schema(description = "Backup creation datetime.")
    OffsetDateTime createdAt,

    @Schema(description = "Backup update datetime.")
    OffsetDateTime updatedAt
) {}

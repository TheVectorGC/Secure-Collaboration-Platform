package dev.cryptoservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

@Schema(description = "Request DTO for encrypted account key backup upload.")
public record UpsertKeyBackupRequestDto(
    @NotNull(message = "Backup version can't be empty.")
    @Positive(message = "Backup version must be positive.")
    @Schema(description = "Client-side monotonically increasing backup version.")
    Long backupVersion,

    @NotBlank(message = "KDF algorithm can't be empty.")
    @Size(max = 32, message = "KDF algorithm is too long.")
    @Schema(description = "Key derivation algorithm used by the client.", example = "scrypt")
    String kdfAlgorithm,

    @NotBlank(message = "KDF salt can't be empty.")
    @Size(max = 512, message = "KDF salt is too long.")
    @Schema(description = "Base64-encoded KDF salt.")
    String kdfSaltBase64,

    @NotBlank(message = "KDF parameters can't be empty.")
    @Size(max = 4000, message = "KDF parameters JSON is too long.")
    @Schema(description = "Client-side KDF parameters JSON.")
    String kdfParametersJson,

    @NotBlank(message = "Encryption algorithm can't be empty.")
    @Size(max = 32, message = "Encryption algorithm is too long.")
    @Schema(description = "Backup encryption algorithm.", example = "AES-256-GCM")
    String encryptionAlgorithm,

    @NotBlank(message = "Initialization vector can't be empty.")
    @Size(max = 512, message = "Initialization vector is too long.")
    @Schema(description = "Base64-encoded initialization vector.")
    String initializationVectorBase64,

    @NotBlank(message = "Authentication tag can't be empty.")
    @Size(max = 512, message = "Authentication tag is too long.")
    @Schema(description = "Base64-encoded authentication tag.")
    String authenticationTagBase64,

    @NotBlank(message = "Encrypted backup blob can't be empty.")
    @Size(max = 25_000_000, message = "Encrypted backup blob is too large.")
    @Schema(description = "Base64-encoded encrypted backup archive.")
    String encryptedBackupBlobBase64
) {}

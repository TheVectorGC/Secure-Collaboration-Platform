package dev.cryptoservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Request DTO for account-level history recovery key profile.")
public record UpsertAccountBackupProfileRequestDto(
    @NotBlank(message = "Backup public key can't be empty.")
    @Size(max = 16000, message = "Backup public key is too large.")
    String backupPublicKeyBase64,

    @NotBlank(message = "Encrypted backup private key can't be empty.")
    @Size(max = 32000, message = "Encrypted backup private key is too large.")
    String encryptedBackupPrivateKeyBase64,

    @NotBlank(message = "KDF algorithm can't be empty.")
    @Size(max = 64, message = "KDF algorithm is too long.")
    String kdfAlgorithm,

    @NotBlank(message = "KDF salt can't be empty.")
    @Size(max = 512, message = "KDF salt is too long.")
    String kdfSaltBase64,

    @NotBlank(message = "KDF parameters can't be empty.")
    @Size(max = 4000, message = "KDF parameters are too long.")
    String kdfParametersJson,

    @NotBlank(message = "Private key encryption algorithm can't be empty.")
    @Size(max = 64, message = "Private key encryption algorithm is too long.")
    String privateKeyEncryptionAlgorithm,

    @NotBlank(message = "Private key initialization vector can't be empty.")
    @Size(max = 512, message = "Private key initialization vector is too long.")
    String privateKeyInitializationVectorBase64,

    @NotBlank(message = "Private key authentication tag can't be empty.")
    @Size(max = 512, message = "Private key authentication tag is too long.")
    String privateKeyAuthenticationTagBase64
) {}

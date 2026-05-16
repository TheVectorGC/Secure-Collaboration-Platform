package dev.documentservice.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateDocumentRequestDto(
    @NotNull(message = "Chat ID is required.")
    UUID chatId,

    @NotNull(message = "Media file ID is required.")
    UUID mediaFileId,

    @NotBlank(message = "File name is required.")
    @Size(max = 255, message = "File name is too long.")
    String fileName,

    @NotBlank(message = "MIME type is required.")
    @Size(max = 255, message = "MIME type is too long.")
    String mimeType,

    @PositiveOrZero(message = "File size must be non-negative.")
    long sizeBytes,

    @NotBlank(message = "Plaintext SHA-256 hash is required.")
    @Size(max = 64, message = "Plaintext SHA-256 hash is too long.")
    String plaintextSha256Base64,

    @NotBlank(message = "Encrypted SHA-256 hash is required.")
    @Size(max = 64, message = "Encrypted SHA-256 hash is too long.")
    String encryptedSha256Base64
) {}

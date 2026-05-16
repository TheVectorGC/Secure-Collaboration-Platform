package dev.mediaservice.model.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record UploadEncryptedMediaRequestDto(
    @NotNull(message = "Chat ID is required.")
    UUID chatId,

    @Size(max = 64, message = "Encrypted SHA-256 hash must not exceed 64 characters.")
    String encryptedSha256Base64
) {}

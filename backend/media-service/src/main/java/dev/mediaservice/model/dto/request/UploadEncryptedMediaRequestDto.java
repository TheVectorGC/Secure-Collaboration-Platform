package dev.mediaservice.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record UploadEncryptedMediaRequestDto(
    UUID chatId,

    @NotBlank(message = "Encrypted SHA-256 hash is required.")
    @Size(min = 44, max = 44, message = "Encrypted SHA-256 hash must be 44 Base64 characters.")
    String encryptedSha256Base64,

    List<@NotNull(message = "Access account ID is required.") UUID> accessAccountIds
) {}

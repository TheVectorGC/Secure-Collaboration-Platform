package dev.mediaservice.model.dto.request;

import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record UploadEncryptedMediaRequestDto(
    UUID chatId,
    @Size(max = 64, message = "Encrypted SHA-256 hash must not exceed 64 characters.")
    String encryptedSha256Base64,
    List<UUID> accessAccountIds) {}

package dev.mediaservice.model.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MediaFileResponseDto(
    UUID id,
    UUID chatId,
    UUID uploaderAccountId,
    long encryptedSizeBytes,
    String encryptedSha256Base64,
    OffsetDateTime createdAt
) {}

package dev.messagingservice.model.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MessageReactionResponseDto(
    UUID messageId,
    UUID accountId,
    String emoji,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}

package dev.documentservice.model.dto.response;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record InternalChatResponseDto(
    UUID chatId,
    String type,
    List<UUID> participantAccountIds,
    UUID lastMessageId,
    OffsetDateTime lastMessageCreatedAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}

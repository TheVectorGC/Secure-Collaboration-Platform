package dev.messagingservice.model.dto.response;

import dev.messagingservice.model.enumeration.ChatParticipantRole;
import dev.messagingservice.model.enumeration.ChatParticipantStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ChatParticipantResponseDto(
    UUID accountId,
    ChatParticipantRole role,
    ChatParticipantStatus status,
    UUID historyVisibleFromMessageId,
    OffsetDateTime historyVisibleFromCreatedAt,
    OffsetDateTime joinedAt,
    OffsetDateTime removedAt
) {}

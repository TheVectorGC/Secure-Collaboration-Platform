package dev.messagingservice.model.dto.response;

import java.time.OffsetDateTime;

public record ChatParticipantVisibilityWindowResponseDto(
    OffsetDateTime visibleFromCreatedAt,
    OffsetDateTime visibleUntilCreatedAt
) {}

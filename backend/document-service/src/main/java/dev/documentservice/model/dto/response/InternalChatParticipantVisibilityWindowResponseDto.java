package dev.documentservice.model.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record InternalChatParticipantVisibilityWindowResponseDto(
    OffsetDateTime visibleFromCreatedAt,
    OffsetDateTime visibleUntilCreatedAt
) {}

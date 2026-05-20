package dev.mediaservice.model.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record InternalChatParticipantResponseDto(
    UUID accountId,
    String role,
    String status,
    UUID historyVisibleFromMessageId,
    OffsetDateTime historyVisibleFromCreatedAt,
    OffsetDateTime joinedAt,
    OffsetDateTime removedAt,
    List<InternalChatParticipantVisibilityWindowResponseDto> visibilityWindows
) {}

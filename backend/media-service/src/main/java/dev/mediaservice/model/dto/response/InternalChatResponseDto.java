package dev.mediaservice.model.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record InternalChatResponseDto(
    UUID chatId,
    String type,
    String name,
    Integer currentKeyEpoch,
    List<UUID> participantAccountIds,
    List<InternalChatParticipantResponseDto> participants,
    UUID lastMessageId,
    OffsetDateTime lastMessageCreatedAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}

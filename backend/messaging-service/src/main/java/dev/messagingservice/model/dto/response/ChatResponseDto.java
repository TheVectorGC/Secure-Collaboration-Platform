package dev.messagingservice.model.dto.response;

import dev.messagingservice.model.enumeration.ChatType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(description = "Response DTO for chat.")
public record ChatResponseDto(
    @Schema(description = "Chat ID.")
    UUID chatId,

    @Schema(description = "Chat type.")
    ChatType type,

    @Schema(description = "Participant account IDs.")
    List<UUID> participantAccountIds,

    @Schema(description = "Last message ID.")
    UUID lastMessageId,

    @Schema(description = "Last message datetime.")
    OffsetDateTime lastMessageCreatedAt,

    @Schema(description = "Chat creation datetime.")
    OffsetDateTime createdAt,

    @Schema(description = "Chat update datetime.")
    OffsetDateTime updatedAt
) {}

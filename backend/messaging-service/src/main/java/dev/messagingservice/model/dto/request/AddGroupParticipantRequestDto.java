package dev.messagingservice.model.dto.request;

import dev.messagingservice.model.enumeration.GroupHistoryAccessMode;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

@Schema(description = "Request DTO for adding participant to group chat.")
public record AddGroupParticipantRequestDto(
    @NotNull(message = "Participant account ID can't be empty.")
    UUID accountId,

    @NotNull(message = "History access mode can't be empty.")
    GroupHistoryAccessMode historyAccessMode,

    @Schema(description = "Boundary message ID for FROM_MESSAGE history access mode.")
    UUID historyVisibleFromMessageId
) {}

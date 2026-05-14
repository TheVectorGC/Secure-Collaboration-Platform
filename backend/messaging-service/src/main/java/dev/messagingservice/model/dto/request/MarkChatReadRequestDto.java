package dev.messagingservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

@Schema(description = "Request DTO for marking chat as read.")
public record MarkChatReadRequestDto(
    @NotNull(message = "Message ID can't be empty.")
    @Schema(description = "Last read message ID.")
    UUID messageId
) {}

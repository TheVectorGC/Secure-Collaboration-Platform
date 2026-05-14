package dev.messagingservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

@Schema(description = "Request DTO for creating or resolving direct chat.")
public record CreateDirectChatRequestDto(
    @NotNull(message = "Recipient account ID can't be empty.")
    @Schema(description = "Recipient account ID.")
    UUID recipientAccountId
) {}

package dev.messagingservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

@Schema(description = "Request DTO for creating group chat.")
public record CreateGroupChatRequestDto(
    @NotBlank(message = "Group name can't be empty.")
    @Size(max = 120, message = "Group name must be less than 120 characters.")
    @Schema(description = "Group display name.")
    String name,

    @NotEmpty(message = "Group participants can't be empty.")
    @Size(max = 500, message = "One group can't contain more than 500 participants in this operation.")
    @Schema(description = "Initial participant account IDs, not including current account if omitted.")
    List<UUID> participantAccountIds
) {}

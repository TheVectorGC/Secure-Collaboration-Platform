package dev.messagingservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

@Schema(description = "Request DTO for updating group chat avatar.")
public record UpdateGroupAvatarRequestDto(
    @Size(max = 700000, message = "Group avatar data URL is too large.")
    @Schema(description = "Compressed image data URL. Null or blank value resets group avatar.")
    String avatarDataUrl
) {}

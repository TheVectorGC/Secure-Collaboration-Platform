package dev.identityservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

@Schema(description = "Request DTO for updating current account avatar")
public record UpdateProfileAvatarRequestDto(
    @Size(max = 700000, message = "Avatar data URL is too large.")
    @Schema(description = "Compressed image data URL. Null or blank value resets avatar to automatic initials.")
    String avatarDataUrl
) {}

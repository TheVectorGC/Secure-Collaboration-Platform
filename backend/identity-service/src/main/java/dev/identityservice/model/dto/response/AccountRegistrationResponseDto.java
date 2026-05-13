package dev.identityservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Response DTO for account registration invite")
public record AccountRegistrationResponseDto(
    @Schema(description = "Registration ID")
    UUID registrationId,
    @Schema(description = "Reserved username")
    String username,
    @Schema(description = "Reserved email")
    String email,
    @Schema(description = "Raw one-time invite token")
    String registrationToken,
    @Schema(description = "Invite expiration datetime")
    OffsetDateTime expiresAt
) {}

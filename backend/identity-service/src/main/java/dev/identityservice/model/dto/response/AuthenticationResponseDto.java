package dev.identityservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Response DTO containing issued token pair")
public record AuthenticationResponseDto(
    @Schema(description = "JWT access token")
    String accessToken,
    @Schema(description = "Refresh token")
    String refreshToken,
    @Schema(description = "Token type", example = "Bearer")
    String tokenType,
    @Schema(description = "Access token expiration datetime")
    OffsetDateTime accessTokenExpiresAt,
    @Schema(description = "Refresh session ID")
    UUID sessionId
) {}

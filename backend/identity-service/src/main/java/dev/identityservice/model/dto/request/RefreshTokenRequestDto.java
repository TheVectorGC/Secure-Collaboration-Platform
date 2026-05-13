package dev.identityservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Request DTO for refreshing token pair")
public record RefreshTokenRequestDto(
    @NotBlank(message = "Refresh token can't be empty.")
    @Schema(description = "Raw refresh token")
    String refreshToken
) {}

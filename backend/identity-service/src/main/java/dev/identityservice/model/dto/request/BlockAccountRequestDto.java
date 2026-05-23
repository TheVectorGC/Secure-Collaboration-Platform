package dev.identityservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

@Schema(description = "Request DTO for blocking another account.")
public record BlockAccountRequestDto(
        @NotNull(message = "Blocked account ID can't be empty.")
        @Schema(description = "Account ID to block.")
        UUID blockedAccountId
) {}

package dev.identityservice.model.dto.request;

import dev.identityservice.model.enumeration.DevicePlatform;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

@Schema(description = "Request DTO for account login.")
public record LoginRequestDto(
        @NotBlank(message = "Login can't be empty.")
        @Schema(description = "Username or email.", example = "ivan.petrov")
        String login,

        @NotBlank(message = "Password can't be empty.")
        @Schema(description = "Account password.", example = "StrongPassword123")
        String password,

        @Schema(description = "Existing device ID. Can be null for first login from a new device.")
        UUID deviceId,

        @Size(max = 64, message = "Client installation ID must be less than 64 characters.")
        @Schema(description = "Stable local client installation ID. Used to avoid duplicate devices from the same desktop installation.")
        String clientInstallationId,

        @Size(max = 100, message = "Device name must be less than 100 characters.")
        @Schema(description = "Device name. Required when deviceId is null.", example = "Ivan Windows Laptop")
        String deviceName,

        @Schema(description = "Device platform. Required when deviceId is null.", example = "WINDOWS")
        DevicePlatform platform,

        @Size(max = 50, message = "Client version must be less than 50 characters.")
        @Schema(description = "Desktop client version.", example = "0.1.0")
        String clientVersion
) {}
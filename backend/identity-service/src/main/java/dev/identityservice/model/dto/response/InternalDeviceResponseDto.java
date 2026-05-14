package dev.identityservice.model.dto.response;

import dev.identityservice.model.enumeration.DeviceStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Internal response DTO representing device snapshot for backend services.")
public record InternalDeviceResponseDto(
    @Schema(description = "Device ID.")
    UUID deviceId,

    @Schema(description = "Account ID owning the device.")
    UUID accountId,

    @Schema(description = "Device status.")
    DeviceStatus status
) {}

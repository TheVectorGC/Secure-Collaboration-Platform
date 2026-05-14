package dev.cryptoservice.model.dto.response;

import dev.cryptoservice.model.enumeration.DeviceStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Internal identity-service device response.")
public record InternalDeviceResponseDto(
    @Schema(description = "Device ID.")
    UUID deviceId,

    @Schema(description = "Owner account ID.")
    UUID accountId,

    @Schema(description = "Device status.")
    DeviceStatus status
) {}

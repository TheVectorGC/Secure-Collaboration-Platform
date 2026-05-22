package dev.identityservice.model.dto.response;

import dev.identityservice.model.enumeration.DevicePlatform;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Response DTO representing active account device for encryption targeting.")
public record ActiveDeviceResponseDto(
    @Schema(description = "Device ID.")
    UUID deviceId,

    @Schema(description = "Account ID owning the device.")
    UUID accountId,

    @Schema(description = "Device name.")
    String deviceName,

    @Schema(description = "Device platform.")
    DevicePlatform platform,

    @Schema(description = "Desktop client version.")
    String clientVersion,

    @Schema(description = "Operating system display name.")
    String osName,

    @Schema(description = "Operating system version.")
    String osVersion,

    @Schema(description = "CPU architecture.")
    String architecture,

    @Schema(description = "Local device hostname.")
    String hostname,

    @Schema(description = "SHA-256 fingerprint of the device identity key.")
    String deviceFingerprint,

    @Schema(description = "Last device activity time.")
    OffsetDateTime lastSeenAt
) {}

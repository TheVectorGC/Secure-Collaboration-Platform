package dev.identityservice.model.dto.response;

import dev.identityservice.model.enumeration.DevicePlatform;
import dev.identityservice.model.enumeration.DeviceStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Response DTO representing user device.")
public record DeviceResponseDto(
        @Schema(description = "Device ID.")
        UUID deviceId,

        @Schema(description = "Device name.", example = "Ivan Windows Laptop")
        String deviceName,

        @Schema(description = "Device platform.", example = "WINDOWS")
        DevicePlatform platform,

        @Schema(description = "Device status.", example = "ACTIVE")
        DeviceStatus status,

        @Schema(description = "Desktop client version.", example = "0.1.0")
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
        OffsetDateTime lastSeenAt,

        @Schema(description = "Device creation time.")
        OffsetDateTime createdAt
) {}

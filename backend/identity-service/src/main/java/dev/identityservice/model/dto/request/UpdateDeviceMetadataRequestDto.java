package dev.identityservice.model.dto.request;

import dev.identityservice.model.enumeration.DevicePlatform;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

@Schema(description = "Request DTO for updating device metadata and cryptographic fingerprint.")
public record UpdateDeviceMetadataRequestDto(
        @Size(max = 100, message = "Device name must be less than 100 characters.")
        @Schema(description = "Device name.")
        String deviceName,

        @Schema(description = "Device platform.")
        DevicePlatform platform,

        @Size(max = 50, message = "Client version must be less than 50 characters.")
        @Schema(description = "Desktop client version.")
        String clientVersion,

        @Size(max = 120, message = "OS name must be less than 120 characters.")
        @Schema(description = "Operating system display name.")
        String osName,

        @Size(max = 120, message = "OS version must be less than 120 characters.")
        @Schema(description = "Operating system version.")
        String osVersion,

        @Size(max = 64, message = "Architecture must be less than 64 characters.")
        @Schema(description = "CPU architecture.")
        String architecture,

        @Size(max = 120, message = "Hostname must be less than 120 characters.")
        @Schema(description = "Local device hostname.")
        String hostname,

        @Size(max = 128, message = "Device fingerprint must be less than 128 characters.")
        @Schema(description = "SHA-256 fingerprint of the device identity key.")
        String deviceFingerprint
) {}

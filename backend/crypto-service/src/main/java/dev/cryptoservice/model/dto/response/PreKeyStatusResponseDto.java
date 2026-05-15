package dev.cryptoservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Response DTO for device prekey status.")
public record PreKeyStatusResponseDto(
    @Schema(description = "Device ID.")
    UUID deviceId,

    @Schema(description = "Whether identity key is registered.")
    boolean identityKeyRegistered,

    @Schema(description = "Whether active signed prekey is registered.")
    boolean activeSignedPreKeyRegistered,

    @Schema(description = "Whether active Kyber prekey is registered.")
    boolean activeKyberPreKeyRegistered,

    @Schema(description = "Number of available one-time prekeys.")
    long availableOneTimePreKeyCount,

    @Schema(description = "Whether available one-time prekey count is below configured threshold.")
    boolean lowPreKeyThresholdReached
) {}

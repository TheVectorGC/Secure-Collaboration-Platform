package dev.cryptoservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Response DTO for prekey bundle.")
public record PreKeyBundleResponseDto(
    @Schema(description = "Target device ID.")
    UUID deviceId,

    @Schema(description = "Device identity public key.")
    IdentityKeyResponseDto identityKey,

    @Schema(description = "Active signed prekey.")
    SignedPreKeyResponseDto signedPreKey,

    @Schema(description = "Available one-time prekey. Can be null when no one-time prekeys are available.")
    OneTimePreKeyResponseDto oneTimePreKey
) {}

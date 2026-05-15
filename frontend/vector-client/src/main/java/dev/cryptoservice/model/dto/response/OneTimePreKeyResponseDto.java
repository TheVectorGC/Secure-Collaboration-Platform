package dev.cryptoservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Response DTO for one-time prekey.")
public record OneTimePreKeyResponseDto(
    @Schema(description = "One-time prekey ID inside client local key store.")
    Integer keyId,

    @Schema(description = "Serialized one-time prekey public key.")
    String publicKey
) {}

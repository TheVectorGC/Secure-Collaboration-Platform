package dev.cryptoservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Response DTO for signed prekey.")
public record SignedPreKeyResponseDto(
    @Schema(description = "Signed prekey ID inside client local key store.")
    Integer keyId,

    @Schema(description = "Serialized signed prekey public key.")
    String publicKey,

    @Schema(description = "Signed prekey signature.")
    String signature
) {}

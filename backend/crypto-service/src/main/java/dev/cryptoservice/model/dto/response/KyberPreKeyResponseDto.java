package dev.cryptoservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Response DTO for Kyber prekey.")
public record KyberPreKeyResponseDto(
    @Schema(description = "Kyber prekey ID inside client local key store.")
    Integer keyId,

    @Schema(description = "Serialized Kyber prekey public key.")
    String publicKey,

    @Schema(description = "Kyber prekey signature.")
    String signature
) {}

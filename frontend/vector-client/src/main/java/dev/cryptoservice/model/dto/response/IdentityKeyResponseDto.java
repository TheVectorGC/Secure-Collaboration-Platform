package dev.cryptoservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

@Schema(description = "Response DTO for device identity key.")
public record IdentityKeyResponseDto(
    @Schema(description = "Serialized public identity key.")
    String publicKey,

    @Schema(description = "Public key fingerprint.")
    String fingerprint,

    @Schema(description = "Creation datetime.")
    OffsetDateTime createdAt
) {}

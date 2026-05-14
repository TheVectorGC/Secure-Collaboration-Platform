package dev.cryptoservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Request DTO for registering device identity public key.")
public record RegisterIdentityKeyRequestDto(
    @NotBlank(message = "Public key can't be empty.")
    @Size(max = 10000, message = "Public key is too long.")
    @Schema(description = "Serialized public identity key.")
    String publicKey
) {}

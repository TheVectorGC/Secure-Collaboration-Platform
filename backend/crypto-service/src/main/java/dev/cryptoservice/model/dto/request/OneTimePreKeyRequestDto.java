package dev.cryptoservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

@Schema(description = "Request DTO for one-time prekey.")
public record OneTimePreKeyRequestDto(
    @NotNull(message = "Key ID can't be empty.")
    @Positive(message = "Key ID must be positive.")
    @Schema(description = "Prekey ID inside client local key store.", example = "42")
    Integer keyId,

    @NotBlank(message = "Public key can't be empty.")
    @Size(max = 10000, message = "Public key is too long.")
    @Schema(description = "Serialized one-time prekey public key.")
    String publicKey
) {}

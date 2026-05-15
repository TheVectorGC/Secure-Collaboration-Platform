package dev.cryptoservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;

@Schema(description = "Request DTO for uploading signed prekey.")
public record UploadSignedPreKeyRequestDto(
    @NotNull(message = "Key ID can't be empty.")
    @Positive(message = "Key ID must be positive.")
    @Schema(description = "Prekey ID inside client local key store.", example = "1")
    Integer keyId,

    @NotBlank(message = "Public key can't be empty.")
    @Size(max = 10000, message = "Public key is too long.")
    @Schema(description = "Serialized signed prekey public key.")
    String publicKey,

    @NotBlank(message = "Signature can't be empty.")
    @Size(max = 10000, message = "Signature is too long.")
    @Schema(description = "Signature created by device identity private key.")
    String signature,

    @Schema(description = "Optional signed prekey expiration datetime.")
    OffsetDateTime expiresAt
) {}

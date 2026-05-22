package dev.messagingservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

@Schema(description = "Encrypted content key envelope for an account.")
public record AccountKeyEnvelopeRequestDto(
    @NotNull(message = "Target account ID can't be empty.")
    UUID targetAccountId,

    @NotBlank(message = "Envelope algorithm can't be empty.")
    @Size(max = 64, message = "Envelope algorithm is too long.")
    String algorithm,

    @NotBlank(message = "Encrypted key can't be empty.")
    @Size(max = 32000, message = "Encrypted key is too large.")
    String encryptedKeyBase64
) {}

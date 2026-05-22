package dev.messagingservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.UUID;

@Schema(description = "Request DTO for sharing a group epoch key envelope with a participant account.")
public record UpsertGroupEpochKeyEnvelopeRequestDto(
    @NotNull(message = "Epoch can't be empty.")
    @Positive(message = "Epoch must be positive.")
    Integer epoch,

    @NotNull(message = "Target account ID can't be empty.")
    UUID targetAccountId,

    @NotNull(message = "Sender device ID can't be empty.")
    UUID senderDeviceId,

    @NotBlank(message = "Algorithm can't be empty.")
    @Size(max = 64, message = "Algorithm is too long.")
    String algorithm,

    @NotBlank(message = "Encrypted key can't be empty.")
    @Size(max = 32000, message = "Encrypted key is too large.")
    String encryptedKeyBase64
) {}

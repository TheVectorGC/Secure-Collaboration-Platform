package dev.messagingservice.model.dto.request;

import dev.messagingservice.model.enumeration.MessageCiphertextType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

@Schema(description = "Request DTO containing encrypted payload for a specific target device.")
public record DeviceMessagePayloadRequestDto(
    @NotNull(message = "Target account ID can't be empty.")
    @Schema(description = "Target account ID owning the target device.")
    UUID targetAccountId,

    @NotNull(message = "Target device ID can't be empty.")
    @Schema(description = "Target device ID that can decrypt this payload.")
    UUID targetDeviceId,

    @NotNull(message = "Ciphertext type can't be empty.")
    @Schema(description = "Signal ciphertext type.", example = "PRE_KEY")
    MessageCiphertextType ciphertextType,

    @NotBlank(message = "Encrypted payload can't be empty.")
    @Size(max = 200000, message = "Encrypted payload is too long.")
    @Schema(description = "Encrypted message payload for the target device.")
    String encryptedPayload
) {}

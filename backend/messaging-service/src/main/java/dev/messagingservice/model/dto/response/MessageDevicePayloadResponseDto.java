package dev.messagingservice.model.dto.response;

import dev.messagingservice.model.enumeration.MessageCiphertextType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Response DTO containing encrypted message payload for a specific device.")
public record MessageDevicePayloadResponseDto(
    @Schema(description = "Target account ID owning the target device.")
    UUID targetAccountId,

    @Schema(description = "Target device ID that can decrypt this payload.")
    UUID targetDeviceId,

    @Schema(description = "Signal ciphertext type.")
    MessageCiphertextType ciphertextType,

    @Schema(description = "Encrypted message payload for the target device.")
    String encryptedPayload
) {}

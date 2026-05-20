package dev.messagingservice.model.dto.request;

import dev.messagingservice.model.enumeration.MessageEncryptionType;
import dev.messagingservice.model.enumeration.MessageType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

@Schema(description = "Request DTO for sending an end-to-end encrypted message.")
public record SendMessageRequestDto(
    @NotNull(message = "Sender device ID can't be empty.")
    @Schema(description = "Sender device ID.")
    UUID senderDeviceId,

    @Size(max = 100, message = "Client message ID must be less than 100 characters.")
    @Schema(description = "Client-generated message ID for idempotency.")
    String clientMessageId,

    @NotNull(message = "Message type can't be empty.")
    @Schema(description = "Message type.", example = "TEXT")
    MessageType messageType,

    @NotNull(message = "Encryption type can't be empty.")
    @Schema(description = "Encryption type.", example = "SIGNAL")
    MessageEncryptionType encryptionType,

    @Size(max = 2000000, message = "Encrypted group payload is too large.")
    @Schema(description = "Single group sender-key ciphertext. Used for GROUP encryption.")
    String encryptedPayload,

    @Valid
    @Size(max = 5000, message = "Device payload list is too large.")
    @Schema(description = "Encrypted payloads, one per target device. Used for SIGNAL encryption and group key distribution messages.")
    List<DeviceMessagePayloadRequestDto> devicePayloads
) {}

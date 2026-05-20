package dev.messagingservice.model.dto.response;

import dev.messagingservice.model.enumeration.MessageEncryptionType;
import dev.messagingservice.model.enumeration.MessageType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(description = "Response DTO for an encrypted message.")
public record MessageResponseDto(
    @Schema(description = "Message ID.")
    UUID messageId,

    @Schema(description = "Chat ID.")
    UUID chatId,

    @Schema(description = "Sender account ID.")
    UUID senderAccountId,

    @Schema(description = "Sender device ID.")
    UUID senderDeviceId,

    @Schema(description = "Client-generated message ID.")
    String clientMessageId,

    @Schema(description = "Message type.")
    MessageType messageType,

    @Schema(description = "Encryption type.")
    MessageEncryptionType encryptionType,

    @Schema(description = "Primary encrypted payload for backward-compatible clients. New clients must use devicePayloads.")
    String encryptedPayload,

    @Schema(description = "Encrypted payloads available to the current account devices.")
    List<MessageDevicePayloadResponseDto> devicePayloads,

    @Schema(description = "Creation datetime.")
    OffsetDateTime createdAt,

    @Schema(description = "Delivery states.")
    List<MessageDeliveryStateResponseDto> deliveryStates
) {}

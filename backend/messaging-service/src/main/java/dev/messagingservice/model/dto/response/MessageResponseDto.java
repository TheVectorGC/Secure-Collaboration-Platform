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

    @Schema(description = "AES-GCM encrypted message body or system payload.")
    String encryptedPayload,

    @Schema(description = "Content encryption algorithm.")
    String contentAlgorithm,

    @Schema(description = "Content encryption initialization vector.")
    String contentInitializationVectorBase64,

    @Schema(description = "Content authentication tag.")
    String contentAuthenticationTagBase64,

    @Schema(description = "Group key epoch used for GROUP encrypted messages.")
    Integer groupKeyEpoch,

    @Schema(description = "Encrypted content key payloads available to the current account devices.")
    List<MessageDevicePayloadResponseDto> devicePayloads,

    @Schema(description = "Encrypted account-level message key envelopes available to the current account.")
    List<AccountKeyEnvelopeResponseDto> accountKeyEnvelopes,

    @Schema(description = "Encrypted group epoch key envelope available to the current account.")
    AccountKeyEnvelopeResponseDto groupEpochKeyEnvelope,

    @Schema(description = "Creation datetime.")
    OffsetDateTime createdAt,

    @Schema(description = "Last edit datetime.")
    OffsetDateTime editedAt,

    @Schema(description = "Edit version.")
    Integer editVersion,

    @Schema(description = "Delivery states.")
    List<MessageDeliveryStateResponseDto> deliveryStates,

    @Schema(description = "Message reactions.")
    List<MessageReactionResponseDto> reactions
) {}

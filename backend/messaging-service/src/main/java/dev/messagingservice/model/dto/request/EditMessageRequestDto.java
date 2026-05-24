package dev.messagingservice.model.dto.request;

import dev.messagingservice.model.enumeration.MessageEncryptionType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

@Schema(description = "Request DTO for editing an end-to-end encrypted text message.")
public record EditMessageRequestDto(
    @NotNull(message = "Sender device ID can't be empty.")
    @Schema(description = "Sender device ID.")
    UUID senderDeviceId,

    @NotNull(message = "Encryption type can't be empty.")
    @Schema(description = "Encryption type.", example = "CONTENT")
    MessageEncryptionType encryptionType,

    @NotBlank(message = "Encrypted message body can't be empty.")
    @Size(max = 2000000, message = "Encrypted message body is too large.")
    @Schema(description = "AES-GCM encrypted edited message body.")
    String encryptedPayload,

    @NotBlank(message = "Content encryption algorithm can't be empty.")
    @Size(max = 64, message = "Content encryption algorithm is too long.")
    @Schema(description = "Content encryption algorithm.", example = "AES-256-GCM")
    String contentAlgorithm,

    @NotBlank(message = "Content initialization vector can't be empty.")
    @Size(max = 512, message = "Content initialization vector is too long.")
    @Schema(description = "Content encryption initialization vector.")
    String contentInitializationVectorBase64,

    @NotBlank(message = "Content authentication tag can't be empty.")
    @Size(max = 512, message = "Content authentication tag is too long.")
    @Schema(description = "Content authentication tag.")
    String contentAuthenticationTagBase64,

    @Schema(description = "Group key epoch used for GROUP encrypted messages.")
    Integer groupKeyEpoch,

    @Valid
    @Size(max = 5000, message = "Device payload list is too large.")
    @Schema(description = "Encrypted content key payloads, one per active target device.")
    List<DeviceMessagePayloadRequestDto> devicePayloads,

    @Valid
    @Size(max = 5000, message = "Account key envelope list is too large.")
    @Schema(description = "Encrypted content key envelopes, one per active participant account.")
    List<AccountKeyEnvelopeRequestDto> accountKeyEnvelopes
) {}

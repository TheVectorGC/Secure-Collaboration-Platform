package dev.messagingservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Encrypted content key envelope for the current account.")
public record AccountKeyEnvelopeResponseDto(
    UUID targetAccountId,
    String algorithm,
    String encryptedKeyBase64
) {}

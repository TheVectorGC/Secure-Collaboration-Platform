package dev.documentservice.model.dto.response;

import java.util.UUID;

public record DocumentKeyEnvelopeResponseDto(
    UUID envelopeId,
    UUID documentId,
    UUID targetAccountId,
    UUID targetDeviceId,
    String algorithm,
    String encryptedKeyBase64
) {}

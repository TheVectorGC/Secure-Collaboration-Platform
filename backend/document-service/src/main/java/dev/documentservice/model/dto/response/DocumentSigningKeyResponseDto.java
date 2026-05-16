package dev.documentservice.model.dto.response;

import dev.documentservice.model.enumeration.DocumentSigningKeyStatus;
import dev.documentservice.model.enumeration.SignatureAlgorithm;
import java.time.OffsetDateTime;
import java.util.UUID;

public record DocumentSigningKeyResponseDto(
    UUID keyId,
    UUID accountId,
    UUID deviceId,
    SignatureAlgorithm algorithm,
    String publicKeyBase64,
    String fingerprint,
    DocumentSigningKeyStatus status,
    OffsetDateTime createdAt
) {}

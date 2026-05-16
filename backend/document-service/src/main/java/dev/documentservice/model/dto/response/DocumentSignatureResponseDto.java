package dev.documentservice.model.dto.response;

import dev.documentservice.model.enumeration.SignatureAlgorithm;
import java.time.OffsetDateTime;
import java.util.UUID;

public record DocumentSignatureResponseDto(
    UUID signatureId,
    UUID documentId,
    UUID signerAccountId,
    UUID signerDeviceId,
    String signingKeyFingerprint,
    SignatureAlgorithm algorithm,
    String documentHashBase64,
    String signatureBase64,
    OffsetDateTime signedAt
) {}

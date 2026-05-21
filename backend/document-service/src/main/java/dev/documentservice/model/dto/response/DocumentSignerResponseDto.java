package dev.documentservice.model.dto.response;

import dev.documentservice.model.enumeration.DocumentSignerStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record DocumentSignerResponseDto(
    UUID signerId,
    UUID documentId,
    UUID signerAccountId,
    DocumentSignerStatus status,
    OffsetDateTime createdAt,
    OffsetDateTime signedAt,
    OffsetDateTime rejectedAt,
    String rejectionReason
) {}

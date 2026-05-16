package dev.documentservice.model.dto.response;

import dev.documentservice.model.enumeration.DocumentStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record DocumentResponseDto(
    UUID documentId,
    UUID chatId,
    UUID mediaFileId,
    UUID ownerAccountId,
    String fileName,
    String mimeType,
    long sizeBytes,
    String plaintextSha256Base64,
    String encryptedSha256Base64,
    DocumentStatus status,
    UUID rejectedByAccountId,
    OffsetDateTime rejectedAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<DocumentSignatureResponseDto> signatures
) {}

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
    String title,
    String description,
    String fileName,
    String mimeType,
    long sizeBytes,
    String plaintextSha256Base64,
    String encryptedSha256Base64,
    DocumentStatus status,
    UUID rejectedByAccountId,
    OffsetDateTime rejectedAt,
    String rejectionReason,
    UUID cancelledByAccountId,
    OffsetDateTime cancelledAt,
    String cancellationReason,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<DocumentSignerResponseDto> signers,
    List<DocumentObserverResponseDto> observers,
    List<DocumentSignatureResponseDto> signatures,
    DocumentFileEncryptionResponseDto fileEncryption) {}

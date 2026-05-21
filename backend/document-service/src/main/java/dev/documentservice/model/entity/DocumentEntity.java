package dev.documentservice.model.entity;

import dev.documentservice.model.enumeration.DocumentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "documents")
public class DocumentEntity {
    @Id
    private UUID id;

    @Column(name = "chat_id")
    private UUID chatId;

    @Column(name = "media_file_id", nullable = false, unique = true)
    private UUID mediaFileId;

    @Column(name = "owner_account_id", nullable = false)
    private UUID ownerAccountId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", length = 2000)
    private String description;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "mime_type", nullable = false, length = 255)
    private String mimeType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "plaintext_sha256_base64", nullable = false, length = 64)
    private String plaintextSha256Base64;

    @Column(name = "encrypted_sha256_base64", nullable = false, length = 64)
    private String encryptedSha256Base64;

    @Column(name = "file_encryption_algorithm", nullable = false, length = 32)
    private String fileEncryptionAlgorithm;

    @Column(name = "file_encryption_key_base64", nullable = false, length = 512)
    private String fileEncryptionKeyBase64;

    @Column(name = "file_initialization_vector_base64", nullable = false, length = 512)
    private String fileInitializationVectorBase64;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private DocumentStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "rejected_by_account_id")
    private UUID rejectedByAccountId;

    @Column(name = "rejected_at")
    private OffsetDateTime rejectedAt;

    @Column(name = "rejection_reason", length = 1000)
    private String rejectionReason;

    @Column(name = "cancelled_by_account_id")
    private UUID cancelledByAccountId;

    @Column(name = "cancelled_at")
    private OffsetDateTime cancelledAt;

    @Column(name = "cancellation_reason", length = 1000)
    private String cancellationReason;
}

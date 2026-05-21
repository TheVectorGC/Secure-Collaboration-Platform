package dev.mediaservice.model.entity;

import dev.mediaservice.model.enumeration.MediaFileStatus;
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

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "media_files")
public class MediaFileEntity {
    @Id
    private UUID id;

    @Column(name = "uploader_account_id", nullable = false)
    private UUID uploaderAccountId;

    @Column(name = "chat_id")
    private UUID chatId;

    @Column(name = "storage_object_key", nullable = false, unique = true, length = 512)
    private String storageObjectKey;

    @Column(name = "encrypted_size_bytes", nullable = false)
    private long encryptedSizeBytes;

    @Column(name = "encrypted_sha256_base64", nullable = false, length = 64)
    private String encryptedSha256Base64;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private MediaFileStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;
}

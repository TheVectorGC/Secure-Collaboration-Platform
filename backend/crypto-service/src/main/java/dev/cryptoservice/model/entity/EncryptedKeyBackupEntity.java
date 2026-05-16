package dev.cryptoservice.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "encrypted_key_backups")
public class EncryptedKeyBackupEntity {
    @Id
    @Column(name = "account_id")
    private UUID accountId;

    @Column(name = "backup_version", nullable = false)
    private Long backupVersion;

    @Column(name = "kdf_algorithm", nullable = false, length = 32)
    private String kdfAlgorithm;

    @Column(name = "kdf_salt_base64", nullable = false, length = 512)
    private String kdfSaltBase64;

    @Column(name = "kdf_parameters_json", nullable = false, columnDefinition = "TEXT")
    private String kdfParametersJson;

    @Column(name = "encryption_algorithm", nullable = false, length = 32)
    private String encryptionAlgorithm;

    @Column(name = "initialization_vector_base64", nullable = false, length = 512)
    private String initializationVectorBase64;

    @Column(name = "authentication_tag_base64", nullable = false, length = 512)
    private String authenticationTagBase64;

    @Column(name = "encrypted_backup_blob_base64", nullable = false, columnDefinition = "TEXT")
    private String encryptedBackupBlobBase64;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}

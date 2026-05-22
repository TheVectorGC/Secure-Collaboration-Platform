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
@Table(name = "account_backup_profiles")
public class AccountBackupProfileEntity {
    @Id
    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "backup_public_key_base64", nullable = false, columnDefinition = "TEXT")
    private String backupPublicKeyBase64;

    @Column(name = "encrypted_backup_private_key_base64", nullable = false, columnDefinition = "TEXT")
    private String encryptedBackupPrivateKeyBase64;

    @Column(name = "kdf_algorithm", nullable = false, length = 64)
    private String kdfAlgorithm;

    @Column(name = "kdf_salt_base64", nullable = false, length = 512)
    private String kdfSaltBase64;

    @Column(name = "kdf_parameters_json", nullable = false, columnDefinition = "TEXT")
    private String kdfParametersJson;

    @Column(name = "private_key_encryption_algorithm", nullable = false, length = 64)
    private String privateKeyEncryptionAlgorithm;

    @Column(name = "private_key_initialization_vector_base64", nullable = false, length = 512)
    private String privateKeyInitializationVectorBase64;

    @Column(name = "private_key_authentication_tag_base64", nullable = false, length = 512)
    private String privateKeyAuthenticationTagBase64;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}

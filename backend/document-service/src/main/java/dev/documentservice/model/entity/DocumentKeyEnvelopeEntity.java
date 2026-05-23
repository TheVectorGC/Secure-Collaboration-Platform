package dev.documentservice.model.entity;

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
@Table(name = "document_key_envelopes")
public class DocumentKeyEnvelopeEntity {
    @Id
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "target_account_id", nullable = false)
    private UUID targetAccountId;

    @Column(name = "target_device_id")
    private UUID targetDeviceId;

    @Column(name = "algorithm", nullable = false, length = 64)
    private String algorithm;

    @Column(name = "encrypted_key_base64", nullable = false, columnDefinition = "TEXT")
    private String encryptedKeyBase64;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}

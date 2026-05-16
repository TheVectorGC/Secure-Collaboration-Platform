package dev.documentservice.model.entity;

import dev.documentservice.model.enumeration.DocumentSigningKeyStatus;
import dev.documentservice.model.enumeration.SignatureAlgorithm;
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
@Table(name = "device_document_signing_keys")
public class DeviceDocumentSigningKeyEntity {
    @Id
    private UUID id;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "device_id", nullable = false)
    private UUID deviceId;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private SignatureAlgorithm algorithm;

    @Column(name = "public_key_base64", nullable = false, columnDefinition = "TEXT")
    private String publicKeyBase64;

    @Column(nullable = false, unique = true, length = 128)
    private String fingerprint;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private DocumentSigningKeyStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}

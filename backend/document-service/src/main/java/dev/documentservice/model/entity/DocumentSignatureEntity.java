package dev.documentservice.model.entity;

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
@Table(name = "document_signatures")
public class DocumentSignatureEntity {
    @Id
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "signer_account_id", nullable = false)
    private UUID signerAccountId;

    @Column(name = "signer_device_id", nullable = false)
    private UUID signerDeviceId;

    @Column(name = "signing_key_fingerprint", nullable = false, length = 128)
    private String signingKeyFingerprint;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private SignatureAlgorithm algorithm;

    @Column(name = "document_hash_base64", nullable = false, length = 64)
    private String documentHashBase64;

    @Column(name = "signature_base64", nullable = false, columnDefinition = "TEXT")
    private String signatureBase64;

    @Column(name = "signed_at", nullable = false)
    private OffsetDateTime signedAt;
}

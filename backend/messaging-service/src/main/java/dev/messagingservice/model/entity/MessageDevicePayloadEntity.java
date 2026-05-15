package dev.messagingservice.model.entity;

import dev.messagingservice.model.enumeration.MessageCiphertextType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
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
@Table(name = "message_device_payloads")
public class MessageDevicePayloadEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "message_id", nullable = false)
    private UUID messageId;

    @Column(name = "target_account_id", nullable = false)
    private UUID targetAccountId;

    @Column(name = "target_device_id", nullable = false)
    private UUID targetDeviceId;

    @Column(name = "ciphertext_type", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private MessageCiphertextType ciphertextType;

    @Column(name = "encrypted_payload", nullable = false, columnDefinition = "TEXT")
    private String encryptedPayload;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}

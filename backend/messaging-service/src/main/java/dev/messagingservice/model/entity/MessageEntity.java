package dev.messagingservice.model.entity;

import dev.messagingservice.model.enumeration.MessageEncryptionType;
import dev.messagingservice.model.enumeration.MessageType;
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
@Table(name = "messages")
public class MessageEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "chat_id", nullable = false)
    private UUID chatId;

    @Column(name = "sender_account_id", nullable = false)
    private UUID senderAccountId;

    @Column(name = "sender_device_id", nullable = false)
    private UUID senderDeviceId;

    @Column(name = "client_message_id", length = 100)
    private String clientMessageId;

    @Column(name = "message_type", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private MessageType messageType;

    @Column(name = "encryption_type", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private MessageEncryptionType encryptionType;

    @Column(name = "encrypted_payload", columnDefinition = "TEXT")
    private String encryptedPayload;

    @Column(name = "content_algorithm", length = 64)
    private String contentAlgorithm;

    @Column(name = "content_initialization_vector_base64", length = 512)
    private String contentInitializationVectorBase64;

    @Column(name = "content_authentication_tag_base64", length = 512)
    private String contentAuthenticationTagBase64;

    @Column(name = "group_key_epoch")
    private Integer groupKeyEpoch;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "edited_at")
    private OffsetDateTime editedAt;

    @Builder.Default
    @Column(name = "edit_version", nullable = false)
    private Integer editVersion = 0;
}

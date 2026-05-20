package dev.messagingservice.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "chat_participant_visibility_windows")
public class ChatParticipantVisibilityWindowEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "chat_id", nullable = false)
    private UUID chatId;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "visible_from_created_at")
    private OffsetDateTime visibleFromCreatedAt;

    @Column(name = "visible_until_created_at")
    private OffsetDateTime visibleUntilCreatedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}

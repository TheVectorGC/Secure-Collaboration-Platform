package dev.messagingservice.repository;

import dev.messagingservice.model.entity.MessageAccountKeyEnvelopeEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageAccountKeyEnvelopeRepository extends JpaRepository<MessageAccountKeyEnvelopeEntity, UUID> {
    List<MessageAccountKeyEnvelopeEntity> findByMessageId(UUID messageId);

    List<MessageAccountKeyEnvelopeEntity> findByMessageIdInAndTargetAccountId(Collection<UUID> messageIds, UUID targetAccountId);
}

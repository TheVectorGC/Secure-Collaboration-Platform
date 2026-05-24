package dev.messagingservice.repository;

import dev.messagingservice.model.entity.MessageReactionEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageReactionRepository extends JpaRepository<MessageReactionEntity, UUID> {
    List<MessageReactionEntity> findByMessageId(UUID messageId);

    List<MessageReactionEntity> findByMessageIdIn(Collection<UUID> messageIds);

    Optional<MessageReactionEntity> findByMessageIdAndAccountId(UUID messageId, UUID accountId);
}

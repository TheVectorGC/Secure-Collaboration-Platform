package dev.messagingservice.repository;

import dev.messagingservice.model.entity.MessageDeliveryStateEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageDeliveryStateRepository extends JpaRepository<MessageDeliveryStateEntity, UUID> {
    List<MessageDeliveryStateEntity> findByMessageId(UUID messageId);

    List<MessageDeliveryStateEntity> findByMessageIdIn(Collection<UUID> messageIds);

    Optional<MessageDeliveryStateEntity> findByMessageIdAndAccountId(UUID messageId, UUID accountId);
}

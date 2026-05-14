package dev.messagingservice.repository;

import dev.messagingservice.model.entity.MessageEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageRepository extends JpaRepository<MessageEntity, UUID> {
    Optional<MessageEntity> findBySenderAccountIdAndClientMessageId(UUID senderAccountId, String clientMessageId);

    Optional<MessageEntity> findFirstByChatIdOrderByCreatedAtDesc(UUID chatId);

    List<MessageEntity> findTop50ByChatIdOrderByCreatedAtDesc(UUID chatId);
}

package dev.messagingservice.repository;

import dev.messagingservice.model.entity.ChatEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatRepository extends JpaRepository<ChatEntity, UUID> {
    Optional<ChatEntity> findByDirectChatKey(String directChatKey);

    Optional<ChatEntity> findBySelfAccountId(UUID selfAccountId);
}

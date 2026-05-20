package dev.messagingservice.repository;

import dev.messagingservice.model.entity.ChatParticipantVisibilityWindowEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatParticipantVisibilityWindowRepository extends JpaRepository<ChatParticipantVisibilityWindowEntity, UUID> {
    List<ChatParticipantVisibilityWindowEntity> findByChatIdAndAccountIdOrderByCreatedAtAsc(UUID chatId, UUID accountId);

    Optional<ChatParticipantVisibilityWindowEntity> findFirstByChatIdAndAccountIdAndVisibleUntilCreatedAtIsNullOrderByCreatedAtDesc(UUID chatId, UUID accountId);

    void deleteByChatIdAndAccountId(UUID chatId, UUID accountId);
}

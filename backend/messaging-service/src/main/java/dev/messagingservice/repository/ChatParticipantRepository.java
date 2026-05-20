package dev.messagingservice.repository;

import dev.messagingservice.model.entity.ChatParticipantEntity;
import dev.messagingservice.model.enumeration.ChatParticipantStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatParticipantRepository extends JpaRepository<ChatParticipantEntity, UUID> {
    Optional<ChatParticipantEntity> findByChatIdAndAccountId(UUID chatId, UUID accountId);

    boolean existsByChatIdAndAccountIdAndStatus(UUID chatId, UUID accountId, ChatParticipantStatus status);

    List<ChatParticipantEntity> findByAccountIdAndStatus(UUID accountId, ChatParticipantStatus status);

    List<ChatParticipantEntity> findByAccountId(UUID accountId);

    List<ChatParticipantEntity> findByChatIdAndStatus(UUID chatId, ChatParticipantStatus status);

    List<ChatParticipantEntity> findByChatId(UUID chatId);

    List<ChatParticipantEntity> findByChatIdInAndStatus(Collection<UUID> chatIds, ChatParticipantStatus status);
}

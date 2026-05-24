package dev.messagingservice.repository;

import dev.messagingservice.model.entity.ChatParticipantEntity;
import dev.messagingservice.model.enumeration.ChatParticipantStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatParticipantRepository extends JpaRepository<ChatParticipantEntity, UUID> {
    Optional<ChatParticipantEntity> findByChatIdAndAccountId(UUID chatId, UUID accountId);

    boolean existsByChatIdAndAccountIdAndStatus(UUID chatId, UUID accountId, ChatParticipantStatus status);

    List<ChatParticipantEntity> findByAccountId(UUID accountId);

    List<ChatParticipantEntity> findByChatIdAndStatus(UUID chatId, ChatParticipantStatus status);

    List<ChatParticipantEntity> findByChatId(UUID chatId);

    @Query("""
            select distinct recipient.accountId
            from ChatParticipantEntity owner
            join ChatParticipantEntity recipient on recipient.chatId = owner.chatId
            where owner.accountId = :accountId
              and owner.status = dev.messagingservice.model.enumeration.ChatParticipantStatus.ACTIVE
              and recipient.status = dev.messagingservice.model.enumeration.ChatParticipantStatus.ACTIVE
            """)
    List<UUID> findActiveProfileUpdateRecipientAccountIds(@Param("accountId") UUID accountId);
}

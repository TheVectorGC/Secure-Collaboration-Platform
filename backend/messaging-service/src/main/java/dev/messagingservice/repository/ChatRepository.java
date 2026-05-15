package dev.messagingservice.repository;

import dev.messagingservice.model.entity.ChatEntity;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatRepository extends JpaRepository<ChatEntity, UUID> {
    Optional<ChatEntity> findByDirectChatKey(String directChatKey);

    Optional<ChatEntity> findBySelfAccountId(UUID selfAccountId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
        value = """
            insert into chats (id, type, direct_chat_key, self_account_id, created_by_account_id, created_at, updated_at)
            values (:chatId, 'SELF', null, :accountId, :accountId, :createdAt, :createdAt)
            on conflict (self_account_id) do nothing
            """,
        nativeQuery = true
    )
    int insertSelfChatIfAbsent(
        @Param("chatId") UUID chatId,
        @Param("accountId") UUID accountId,
        @Param("createdAt") OffsetDateTime createdAt
    );

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
        value = """
            insert into chats (id, type, direct_chat_key, self_account_id, created_by_account_id, created_at, updated_at)
            values (:chatId, 'DIRECT', :directChatKey, null, :createdByAccountId, :createdAt, :createdAt)
            on conflict (direct_chat_key) do nothing
            """,
        nativeQuery = true
    )
    int insertDirectChatIfAbsent(
        @Param("chatId") UUID chatId,
        @Param("directChatKey") String directChatKey,
        @Param("createdByAccountId") UUID createdByAccountId,
        @Param("createdAt") OffsetDateTime createdAt
    );

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
        value = """
            insert into chat_participants (id, chat_id, account_id, role, status, joined_at, last_read_message_id, last_read_at)
            select :participantId, :chatId, :accountId, :role, :status, :joinedAt, null, null
            where not exists (
                select 1
                from chat_participants
                where chat_id = :chatId
                  and account_id = :accountId
            )
            """,
        nativeQuery = true
    )
    int insertParticipantIfAbsent(
        @Param("participantId") UUID participantId,
        @Param("chatId") UUID chatId,
        @Param("accountId") UUID accountId,
        @Param("role") String role,
        @Param("status") String status,
        @Param("joinedAt") OffsetDateTime joinedAt
    );
}

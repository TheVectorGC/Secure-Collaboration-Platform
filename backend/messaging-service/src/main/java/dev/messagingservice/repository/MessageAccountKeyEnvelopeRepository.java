package dev.messagingservice.repository;

import dev.messagingservice.model.entity.MessageAccountKeyEnvelopeEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageAccountKeyEnvelopeRepository extends JpaRepository<MessageAccountKeyEnvelopeEntity, UUID> {
    List<MessageAccountKeyEnvelopeEntity> findByMessageId(UUID messageId);

    List<MessageAccountKeyEnvelopeEntity> findByMessageIdInAndTargetAccountId(Collection<UUID> messageIds, UUID targetAccountId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "delete from message_account_key_envelopes where message_id = :messageId", nativeQuery = true)
    void deleteByMessageId(@Param("messageId") UUID messageId);
}

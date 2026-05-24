package dev.messagingservice.repository;

import dev.messagingservice.model.entity.MessageDevicePayloadEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageDevicePayloadRepository extends JpaRepository<MessageDevicePayloadEntity, UUID> {
    List<MessageDevicePayloadEntity> findByMessageId(UUID messageId);

    List<MessageDevicePayloadEntity> findByMessageIdInAndTargetAccountId(Collection<UUID> messageIds, UUID targetAccountId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "delete from message_device_payloads where message_id = :messageId", nativeQuery = true)
    void deleteByMessageId(@Param("messageId") UUID messageId);
}

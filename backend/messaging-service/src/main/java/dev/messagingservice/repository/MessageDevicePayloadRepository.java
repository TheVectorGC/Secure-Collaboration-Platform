package dev.messagingservice.repository;

import dev.messagingservice.model.entity.MessageDevicePayloadEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageDevicePayloadRepository extends JpaRepository<MessageDevicePayloadEntity, UUID> {
    List<MessageDevicePayloadEntity> findByMessageId(UUID messageId);

    List<MessageDevicePayloadEntity> findByMessageIdInAndTargetAccountId(Collection<UUID> messageIds, UUID targetAccountId);
}

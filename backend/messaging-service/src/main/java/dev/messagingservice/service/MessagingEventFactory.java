package dev.messagingservice.service;

import dev.messagingservice.model.entity.MessageDevicePayloadEntity;
import dev.messagingservice.model.entity.MessageEntity;
import dev.messagingservice.model.event.MessagingEventDto;
import java.util.List;
import java.util.UUID;

public interface MessagingEventFactory {
    MessagingEventDto createMessageCreatedEvent(
        MessageEntity messageEntity,
        List<MessageDevicePayloadEntity> payloadEntities,
        List<UUID> recipientAccountIds
    );

    MessagingEventDto createMessageDeliveredEvent(UUID chatId, UUID messageId, UUID deliveredByAccountId, List<UUID> recipientAccountIds);

    MessagingEventDto createMessageReadEvent(UUID chatId, UUID lastReadMessageId, UUID readByAccountId, List<UUID> recipientAccountIds);
}

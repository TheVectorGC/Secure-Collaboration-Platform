package dev.messagingservice.service;

import dev.messagingservice.model.dto.response.ChatResponseDto;
import dev.messagingservice.model.entity.MessageDevicePayloadEntity;
import dev.messagingservice.model.entity.MessageEntity;
import dev.messagingservice.model.event.MessagingEventDto;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface MessagingEventFactory {
    MessagingEventDto createMessageCreatedEvent(
            MessageEntity messageEntity,
            List<MessageDevicePayloadEntity> payloadEntities,
            List<UUID> recipientAccountIds
    );

    MessagingEventDto createMessageDeliveredEvent(
            UUID chatId,
            UUID messageId,
            UUID deliveredByAccountId,
            List<UUID> recipientAccountIds
    );

    MessagingEventDto createMessageReadEvent(
            UUID chatId,
            UUID lastReadMessageId,
            List<UUID> readMessageIds,
            UUID readByAccountId,
            OffsetDateTime readAt,
            List<UUID> recipientAccountIds
    );

    MessagingEventDto createChatUpdatedEvent(ChatResponseDto chatResponseDto, List<UUID> recipientAccountIds);
}

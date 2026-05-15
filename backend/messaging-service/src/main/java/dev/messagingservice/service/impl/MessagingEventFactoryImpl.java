package dev.messagingservice.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.messagingservice.model.entity.MessageDevicePayloadEntity;
import dev.messagingservice.model.entity.MessageEntity;
import dev.messagingservice.model.enumeration.MessagingEventType;
import dev.messagingservice.model.event.MessagingEventDto;
import dev.messagingservice.service.MessagingEventFactory;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MessagingEventFactoryImpl implements MessagingEventFactory {
    private final ObjectMapper objectMapper;

    @Override
    public MessagingEventDto createMessageCreatedEvent(
        MessageEntity messageEntity,
        List<MessageDevicePayloadEntity> payloadEntities,
        List<UUID> recipientAccountIds
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("chatId", messageEntity.getChatId());
        payload.put("messageId", messageEntity.getId());
        payload.put("senderAccountId", messageEntity.getSenderAccountId());
        payload.put("senderDeviceId", messageEntity.getSenderDeviceId());
        payload.put("messageType", messageEntity.getMessageType());
        payload.put("encryptionType", messageEntity.getEncryptionType());
        payload.put("devicePayloads", createDevicePayloads(payloadEntities));
        payload.put("createdAt", messageEntity.getCreatedAt());

        return createEvent(
            MessagingEventType.MESSAGE_CREATED,
            messageEntity.getChatId(),
            messageEntity.getId(),
            messageEntity.getSenderAccountId(),
            recipientAccountIds,
            payload
        );
    }

    @Override
    public MessagingEventDto createMessageDeliveredEvent(
        UUID chatId,
        UUID messageId,
        UUID deliveredByAccountId,
        List<UUID> recipientAccountIds
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("chatId", chatId);
        payload.put("messageId", messageId);
        payload.put("deliveredByAccountId", deliveredByAccountId);
        payload.put("deliveredAt", OffsetDateTime.now());

        return createEvent(
            MessagingEventType.MESSAGE_DELIVERED,
            chatId,
            messageId,
            deliveredByAccountId,
            recipientAccountIds,
            payload
        );
    }

    @Override
    public MessagingEventDto createMessageReadEvent(
        UUID chatId,
        UUID lastReadMessageId,
        UUID readByAccountId,
        List<UUID> recipientAccountIds
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("chatId", chatId);
        payload.put("lastReadMessageId", lastReadMessageId);
        payload.put("readByAccountId", readByAccountId);
        payload.put("readAt", OffsetDateTime.now());

        return createEvent(
            MessagingEventType.MESSAGE_READ,
            chatId,
            lastReadMessageId,
            readByAccountId,
            recipientAccountIds,
            payload
        );
    }

    private List<Map<String, Object>> createDevicePayloads(List<MessageDevicePayloadEntity> payloadEntities) {
        return payloadEntities.stream()
            .map(payloadEntity -> {
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("targetAccountId", payloadEntity.getTargetAccountId());
                payload.put("targetDeviceId", payloadEntity.getTargetDeviceId());
                payload.put("ciphertextType", payloadEntity.getCiphertextType());
                payload.put("encryptedPayload", payloadEntity.getEncryptedPayload());
                return payload;
            })
            .toList();
    }

    private MessagingEventDto createEvent(
        MessagingEventType messagingEventType,
        UUID chatId,
        UUID messageId,
        UUID senderAccountId,
        List<UUID> recipientAccountIds,
        Map<String, Object> payload
    ) {
        JsonNode payloadNode = objectMapper.valueToTree(payload);

        return new MessagingEventDto(
            UUID.randomUUID(),
            messagingEventType,
            chatId,
            messageId,
            senderAccountId,
            recipientAccountIds,
            OffsetDateTime.now(),
            payloadNode
        );
    }
}

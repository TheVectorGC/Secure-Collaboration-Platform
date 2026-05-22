package dev.messagingservice.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.messagingservice.model.dto.response.ChatResponseDto;
import dev.messagingservice.model.entity.GroupEpochKeyEnvelopeEntity;
import dev.messagingservice.model.entity.MessageAccountKeyEnvelopeEntity;
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
            List<MessageAccountKeyEnvelopeEntity> accountKeyEnvelopeEntities,
            GroupEpochKeyEnvelopeEntity groupEpochKeyEnvelopeEntity,
            List<UUID> recipientAccountIds
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("chatId", messageEntity.getChatId());
        payload.put("messageId", messageEntity.getId());
        payload.put("senderAccountId", messageEntity.getSenderAccountId());
        payload.put("senderDeviceId", messageEntity.getSenderDeviceId());
        payload.put("clientMessageId", messageEntity.getClientMessageId());
        payload.put("messageType", messageEntity.getMessageType());
        payload.put("encryptionType", messageEntity.getEncryptionType());
        payload.put("encryptedPayload", messageEntity.getEncryptedPayload());
        payload.put("contentAlgorithm", messageEntity.getContentAlgorithm());
        payload.put("contentInitializationVectorBase64", messageEntity.getContentInitializationVectorBase64());
        payload.put("contentAuthenticationTagBase64", messageEntity.getContentAuthenticationTagBase64());
        payload.put("groupKeyEpoch", messageEntity.getGroupKeyEpoch());
        payload.put("devicePayloads", createDevicePayloads(payloadEntities));
        payload.put("accountKeyEnvelopes", createAccountKeyEnvelopes(accountKeyEnvelopeEntities));
        payload.put("groupEpochKeyEnvelope", groupEpochKeyEnvelopeEntity == null ? null : createGroupEpochKeyEnvelope(groupEpochKeyEnvelopeEntity));
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
            List<UUID> readMessageIds,
            UUID readByAccountId,
            OffsetDateTime readAt,
            List<UUID> recipientAccountIds
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("chatId", chatId);
        payload.put("lastReadMessageId", lastReadMessageId);
        payload.put("readMessageIds", readMessageIds);
        payload.put("readByAccountId", readByAccountId);
        payload.put("readAt", readAt);

        return createEvent(
                MessagingEventType.MESSAGE_READ,
                chatId,
                lastReadMessageId,
                readByAccountId,
                recipientAccountIds,
                payload
        );
    }

    @Override
    public MessagingEventDto createChatUpdatedEvent(ChatResponseDto chatResponseDto, List<UUID> recipientAccountIds) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("chat", chatResponseDto);

        return createEvent(
                MessagingEventType.CHAT_UPDATED,
                chatResponseDto.chatId(),
                null,
                null,
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


    private List<Map<String, Object>> createAccountKeyEnvelopes(List<MessageAccountKeyEnvelopeEntity> envelopeEntities) {
        return envelopeEntities.stream()
                .map(envelopeEntity -> {
                    Map<String, Object> payload = new LinkedHashMap<>();
                    payload.put("targetAccountId", envelopeEntity.getTargetAccountId());
                    payload.put("algorithm", envelopeEntity.getAlgorithm());
                    payload.put("encryptedKeyBase64", envelopeEntity.getEncryptedKeyBase64());
                    return payload;
                })
                .toList();
    }

    private Map<String, Object> createGroupEpochKeyEnvelope(GroupEpochKeyEnvelopeEntity envelopeEntity) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("targetAccountId", envelopeEntity.getTargetAccountId());
        payload.put("senderDeviceId", envelopeEntity.getSenderDeviceId());
        payload.put("algorithm", envelopeEntity.getAlgorithm());
        payload.put("encryptedKeyBase64", envelopeEntity.getEncryptedKeyBase64());
        return payload;
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

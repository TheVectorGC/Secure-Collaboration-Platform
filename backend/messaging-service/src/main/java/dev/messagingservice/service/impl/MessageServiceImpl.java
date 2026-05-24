package dev.messagingservice.service.impl;

import dev.messagingservice.exception.ChatAccessDeniedException;
import dev.messagingservice.exception.ChatNotFoundException;
import dev.messagingservice.exception.MessageNotFoundException;
import dev.messagingservice.exception.MessagePayloadValidationException;
import dev.messagingservice.model.dto.request.AccountKeyEnvelopeRequestDto;
import dev.messagingservice.model.dto.request.DeviceMessagePayloadRequestDto;
import dev.messagingservice.model.dto.request.MarkChatReadRequestDto;
import dev.messagingservice.model.dto.request.SendMessageRequestDto;
import dev.messagingservice.model.dto.request.SetMessageReactionRequestDto;
import dev.messagingservice.model.dto.response.MessageResponseDto;
import dev.messagingservice.model.dto.response.MessageReactionResponseDto;
import dev.messagingservice.model.entity.ChatEntity;
import dev.messagingservice.model.entity.ChatParticipantEntity;
import dev.messagingservice.model.entity.ChatParticipantVisibilityWindowEntity;
import dev.messagingservice.model.entity.GroupEpochKeyEnvelopeEntity;
import dev.messagingservice.model.entity.MessageAccountKeyEnvelopeEntity;
import dev.messagingservice.model.entity.MessageDeliveryStateEntity;
import dev.messagingservice.model.entity.MessageDevicePayloadEntity;
import dev.messagingservice.model.entity.MessageEntity;
import dev.messagingservice.model.entity.MessageReactionEntity;
import dev.messagingservice.model.enumeration.ChatParticipantStatus;
import dev.messagingservice.model.enumeration.ChatType;
import dev.messagingservice.model.enumeration.MessageDeliveryStatus;
import dev.messagingservice.model.enumeration.MessageEncryptionType;
import dev.messagingservice.repository.ChatParticipantRepository;
import dev.messagingservice.repository.ChatParticipantVisibilityWindowRepository;
import dev.messagingservice.repository.ChatRepository;
import dev.messagingservice.repository.GroupEpochKeyEnvelopeRepository;
import dev.messagingservice.repository.MessageAccountKeyEnvelopeRepository;
import dev.messagingservice.repository.MessageDeliveryStateRepository;
import dev.messagingservice.repository.MessageDevicePayloadRepository;
import dev.messagingservice.repository.MessageRepository;
import dev.messagingservice.repository.MessageReactionRepository;
import dev.messagingservice.service.MessageService;
import dev.messagingservice.service.MessagingEventFactory;
import dev.messagingservice.service.MessagingEventPublisher;
import dev.messagingservice.service.block.AccountBlockService;
import dev.messagingservice.mapper.ChatMapper;
import dev.messagingservice.mapper.MessageMapper;
import dev.messagingservice.service.validation.MessagePayloadValidator;
import dev.messagingservice.util.TextNormalizer;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageServiceImpl implements MessageService {
    private final ChatRepository chatRepository;
    private final ChatParticipantRepository chatParticipantRepository;
    private final ChatParticipantVisibilityWindowRepository chatParticipantVisibilityWindowRepository;
    private final MessageRepository messageRepository;
    private final MessageReactionRepository messageReactionRepository;
    private final MessageDeliveryStateRepository messageDeliveryStateRepository;
    private final MessageDevicePayloadRepository messageDevicePayloadRepository;
    private final MessageAccountKeyEnvelopeRepository messageAccountKeyEnvelopeRepository;
    private final GroupEpochKeyEnvelopeRepository groupEpochKeyEnvelopeRepository;
    private final MessagingEventPublisher messagingEventPublisher;
    private final MessagingEventFactory messagingEventFactory;
    private final MessagePayloadValidator messagePayloadValidator;
    private final MessageMapper messageMapper;
    private final ChatMapper chatMapper;
    private final AccountBlockService accountBlockService;

    @Override
    @Transactional
    public MessageResponseDto sendMessage(UUID currentAccountId, UUID chatId, SendMessageRequestDto requestDto) {
        ChatEntity chatEntity = getChatForMessaging(currentAccountId, chatId);
        List<ChatParticipantEntity> activeParticipants = chatParticipantRepository.findByChatIdAndStatus(chatId, ChatParticipantStatus.ACTIVE);
        messagePayloadValidator.validate(currentAccountId, requestDto, activeParticipants);

        MessageResponseDto duplicateResponse = resolveDuplicateMessage(currentAccountId, requestDto.clientMessageId());

        if (duplicateResponse != null) {
            return duplicateResponse;
        }

        OffsetDateTime now = OffsetDateTime.now();
        MessageEntity messageEntity = buildMessage(currentAccountId, chatId, requestDto, now);
        MessageEntity savedMessageEntity = messageRepository.save(messageEntity);
        List<MessageDevicePayloadEntity> savedPayloadEntities = saveDevicePayloads(savedMessageEntity.getId(), requestDto.devicePayloads(), now);
        List<MessageAccountKeyEnvelopeEntity> savedEnvelopeEntities = saveAccountKeyEnvelopes(savedMessageEntity.getId(), requestDto.accountKeyEnvelopes(), now);
        List<UUID> recipientAccountIds = createDeliveryStates(savedMessageEntity, currentAccountId, activeParticipants);
        ChatEntity updatedChatEntity = updateChatTimestamp(chatEntity, now);

        publishChatUpdatedEvent(updatedChatEntity, activeParticipants);
        publishMessageCreatedEvent(savedMessageEntity, savedPayloadEntities, savedEnvelopeEntities, recipientAccountIds);
        log.info("Message created. Message ID: {}, chat ID: {}, sender account ID: {}.", savedMessageEntity.getId(), chatId, currentAccountId);

        return messageMapper.toMessageResponse(
                savedMessageEntity,
                filterPayloadsForAccount(savedPayloadEntities, currentAccountId),
                filterAccountKeyEnvelopesForAccount(savedEnvelopeEntities, currentAccountId),
                findGroupEpochEnvelope(savedMessageEntity, currentAccountId),
                messageDeliveryStateRepository.findByMessageId(savedMessageEntity.getId()),
                messageReactionRepository.findByMessageId(savedMessageEntity.getId()),
                currentAccountId
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<MessageResponseDto> getChatMessages(UUID currentAccountId, UUID chatId) {
        ChatParticipantEntity currentParticipant = getKnownParticipant(chatId, currentAccountId);
        List<MessageEntity> messageEntities = messageRepository.findByChatIdOrderByCreatedAtAsc(chatId).stream()
                .filter(messageEntity -> isVisibleToParticipant(messageEntity, currentParticipant))
                .toList();
        List<UUID> messageIds = messageEntities.stream()
                .map(MessageEntity::getId)
                .toList();
        Map<UUID, List<MessageDeliveryStateEntity>> deliveryStatesByMessageId = messageDeliveryStateRepository.findByMessageIdIn(messageIds).stream()
                .collect(Collectors.groupingBy(MessageDeliveryStateEntity::getMessageId));
        Map<UUID, List<MessageDevicePayloadEntity>> payloadsByMessageId = messageDevicePayloadRepository
                .findByMessageIdInAndTargetAccountId(messageIds, currentAccountId)
                .stream()
                .collect(Collectors.groupingBy(MessageDevicePayloadEntity::getMessageId));
        Map<UUID, List<MessageAccountKeyEnvelopeEntity>> envelopesByMessageId = messageAccountKeyEnvelopeRepository
                .findByMessageIdInAndTargetAccountId(messageIds, currentAccountId)
                .stream()
                .collect(Collectors.groupingBy(MessageAccountKeyEnvelopeEntity::getMessageId));
        Map<UUID, List<MessageReactionEntity>> reactionsByMessageId = messageReactionRepository.findByMessageIdIn(messageIds).stream()
                .collect(Collectors.groupingBy(MessageReactionEntity::getMessageId));

        return messageEntities.stream()
                .map(messageEntity -> messageMapper.toMessageResponse(
                        messageEntity,
                        payloadsByMessageId.getOrDefault(messageEntity.getId(), List.of()),
                        envelopesByMessageId.getOrDefault(messageEntity.getId(), List.of()),
                        findGroupEpochEnvelope(messageEntity, currentAccountId),
                        deliveryStatesByMessageId.getOrDefault(messageEntity.getId(), List.of()),
                        reactionsByMessageId.getOrDefault(messageEntity.getId(), List.of()),
                        currentAccountId
                ))
                .toList();
    }

    @Override
    @Transactional
    public void markMessageDelivered(UUID currentAccountId, UUID chatId, UUID messageId) {
        validateActiveParticipant(chatId, currentAccountId);
        MessageEntity messageEntity = getMessageInChat(chatId, messageId);

        if (messageEntity.getSenderAccountId().equals(currentAccountId)) {
            return;
        }

        MessageDeliveryStateEntity deliveryStateEntity = messageDeliveryStateRepository.findByMessageIdAndAccountId(messageId, currentAccountId)
                .orElse(null);

        if (deliveryStateEntity == null || deliveryStateEntity.getStatus() != MessageDeliveryStatus.SENT) {
            return;
        }

        deliveryStateEntity.setStatus(MessageDeliveryStatus.DELIVERED);
        deliveryStateEntity.setDeliveredAt(OffsetDateTime.now());
        messageDeliveryStateRepository.save(deliveryStateEntity);
        publishMessageDeliveredEvent(messageEntity, currentAccountId);
        log.debug("Message delivery state updated to DELIVERED. Message ID: {}, account ID: {}.", messageId, currentAccountId);
    }

    @Override
    @Transactional
    public void markChatRead(UUID currentAccountId, UUID chatId, MarkChatReadRequestDto requestDto) {
        ChatParticipantEntity currentParticipant = getKnownParticipant(chatId, currentAccountId);
        MessageEntity lastReadMessageEntity = getMessageInChat(chatId, requestDto.messageId());

        if (!isVisibleToParticipant(lastReadMessageEntity, currentParticipant)) {
            throw new MessageNotFoundException("Message with ID '" + requestDto.messageId() + "' was not found in this chat.");
        }

        OffsetDateTime readAt = OffsetDateTime.now();
        List<MessageEntity> readMessageEntities = messageRepository.findByChatIdOrderByCreatedAtAsc(chatId).stream()
                .filter(messageEntity -> !messageEntity.getSenderAccountId().equals(currentAccountId))
                .filter(messageEntity -> !messageEntity.getCreatedAt().isAfter(lastReadMessageEntity.getCreatedAt()))
                .filter(messageEntity -> isVisibleToParticipant(messageEntity, currentParticipant))
                .toList();
        List<UUID> readMessageIds = readMessageEntities.stream()
                .map(MessageEntity::getId)
                .toList();

        markMessagesRead(currentAccountId, readMessageIds, readAt);
        currentParticipant.setLastReadMessageId(lastReadMessageEntity.getId());
        currentParticipant.setLastReadAt(readAt);
        chatParticipantRepository.save(currentParticipant);
        publishMessageReadEvent(chatId, lastReadMessageEntity.getId(), readMessageIds, currentAccountId, readAt);
        log.debug("Chat marked as read. Chat ID: {}, account ID: {}, messages: {}.", chatId, currentAccountId, readMessageIds.size());
    }


    @Override
    @Transactional
    public MessageReactionResponseDto setMessageReaction(UUID currentAccountId, UUID chatId, UUID messageId, SetMessageReactionRequestDto requestDto) {
        ChatParticipantEntity currentParticipant = getKnownParticipant(chatId, currentAccountId);
        MessageEntity messageEntity = getMessageInChat(chatId, messageId);

        if (!isVisibleToParticipant(messageEntity, currentParticipant)) {
            throw new MessageNotFoundException("Message with ID '" + messageId + "' was not found in this chat.");
        }

        String emoji = TextNormalizer.trimToNull(requestDto.emoji());

        if (emoji == null) {
            throw new MessagePayloadValidationException("Reaction emoji is required.");
        }

        OffsetDateTime now = OffsetDateTime.now();
        MessageReactionEntity reactionEntity = messageReactionRepository.findByMessageIdAndAccountId(messageId, currentAccountId)
                .map(existingReactionEntity -> updateReaction(existingReactionEntity, emoji, now))
                .orElseGet(() -> createReaction(messageId, currentAccountId, emoji, now));
        MessageReactionEntity savedReactionEntity = messageReactionRepository.save(reactionEntity);
        publishMessageReactionUpdatedEvent(chatId, messageId, currentAccountId, emoji, savedReactionEntity.getUpdatedAt());
        log.debug("Message reaction updated. Message ID: {}, account ID: {}, emoji: {}.", messageId, currentAccountId, emoji);
        return messageMapper.toReactionResponse(savedReactionEntity);
    }

    @Override
    @Transactional
    public void removeMessageReaction(UUID currentAccountId, UUID chatId, UUID messageId) {
        ChatParticipantEntity currentParticipant = getKnownParticipant(chatId, currentAccountId);
        MessageEntity messageEntity = getMessageInChat(chatId, messageId);

        if (!isVisibleToParticipant(messageEntity, currentParticipant)) {
            return;
        }

        MessageReactionEntity reactionEntity = messageReactionRepository.findByMessageIdAndAccountId(messageId, currentAccountId)
                .orElse(null);

        if (reactionEntity == null) {
            return;
        }

        messageReactionRepository.delete(reactionEntity);
        publishMessageReactionUpdatedEvent(chatId, messageId, currentAccountId, null, OffsetDateTime.now());
        log.debug("Message reaction removed. Message ID: {}, account ID: {}.", messageId, currentAccountId);
    }

    private MessageReactionEntity updateReaction(MessageReactionEntity reactionEntity, String emoji, OffsetDateTime now) {
        reactionEntity.setEmoji(emoji);
        reactionEntity.setUpdatedAt(now);
        return reactionEntity;
    }

    private MessageReactionEntity createReaction(UUID messageId, UUID accountId, String emoji, OffsetDateTime now) {
        return MessageReactionEntity.builder()
                .messageId(messageId)
                .accountId(accountId)
                .emoji(emoji)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private ChatEntity getChatForMessaging(UUID currentAccountId, UUID chatId) {
        validateActiveParticipant(chatId, currentAccountId);
        ChatEntity chatEntity = chatRepository.findById(chatId)
                .orElseThrow(() -> new ChatNotFoundException("Chat with ID '" + chatId + "' not found."));

        if (chatEntity.getType() == ChatType.DIRECT) {
            UUID recipientAccountId = chatParticipantRepository.findByChatIdAndStatus(chatId, ChatParticipantStatus.ACTIVE).stream()
                    .map(ChatParticipantEntity::getAccountId)
                    .filter(accountId -> !accountId.equals(currentAccountId))
                    .findFirst()
                    .orElseThrow(() -> new ChatAccessDeniedException("Direct chat recipient was not found."));
            accountBlockService.ensureDirectMessagingAllowed(currentAccountId, recipientAccountId);
        }

        return chatEntity;
    }

    private MessageResponseDto resolveDuplicateMessage(UUID currentAccountId, String clientMessageId) {
        String normalizedClientMessageId = TextNormalizer.trimToNull(clientMessageId);

        if (normalizedClientMessageId == null) {
            return null;
        }

        MessageEntity existingMessageEntity = messageRepository
                .findBySenderAccountIdAndClientMessageId(currentAccountId, normalizedClientMessageId)
                .orElse(null);

        if (existingMessageEntity == null) {
            return null;
        }

        return messageMapper.toMessageResponse(
                existingMessageEntity,
                messageDevicePayloadRepository.findByMessageId(existingMessageEntity.getId()),
                messageAccountKeyEnvelopeRepository.findByMessageId(existingMessageEntity.getId()),
                findGroupEpochEnvelope(existingMessageEntity, currentAccountId),
                messageDeliveryStateRepository.findByMessageId(existingMessageEntity.getId()),
                messageReactionRepository.findByMessageId(existingMessageEntity.getId()),
                currentAccountId
        );
    }

    private MessageEntity buildMessage(UUID currentAccountId, UUID chatId, SendMessageRequestDto requestDto, OffsetDateTime now) {
        return MessageEntity.builder()
                .chatId(chatId)
                .senderAccountId(currentAccountId)
                .senderDeviceId(requestDto.senderDeviceId())
                .clientMessageId(TextNormalizer.trimToNull(requestDto.clientMessageId()))
                .messageType(requestDto.messageType())
                .encryptionType(requestDto.encryptionType())
                .encryptedPayload(TextNormalizer.trimToNull(requestDto.encryptedPayload()))
                .contentAlgorithm(TextNormalizer.trimToNull(requestDto.contentAlgorithm()))
                .contentInitializationVectorBase64(TextNormalizer.trimToNull(requestDto.contentInitializationVectorBase64()))
                .contentAuthenticationTagBase64(TextNormalizer.trimToNull(requestDto.contentAuthenticationTagBase64()))
                .groupKeyEpoch(requestDto.groupKeyEpoch())
                .createdAt(now)
                .build();
    }

    private void validateActiveParticipant(UUID chatId, UUID accountId) {
        boolean activeParticipantExists = chatParticipantRepository.existsByChatIdAndAccountIdAndStatus(chatId, accountId, ChatParticipantStatus.ACTIVE);

        if (!activeParticipantExists) {
            throw new ChatAccessDeniedException("Current account does not have access to this chat.");
        }
    }

    private ChatParticipantEntity getKnownParticipant(UUID chatId, UUID accountId) {
        ChatParticipantEntity participantEntity = chatParticipantRepository.findByChatIdAndAccountId(chatId, accountId)
                .orElseThrow(() -> new ChatAccessDeniedException("Current account does not have access to this chat."));

        if (participantEntity.getStatus() == ChatParticipantStatus.LEFT) {
            throw new ChatAccessDeniedException("Current account does not have access to this chat.");
        }

        return participantEntity;
    }

    private boolean isVisibleToParticipant(MessageEntity messageEntity, ChatParticipantEntity participantEntity) {
        List<ChatParticipantVisibilityWindowEntity> visibilityWindowEntities = chatParticipantVisibilityWindowRepository
                .findByChatIdAndAccountIdOrderByCreatedAtAsc(participantEntity.getChatId(), participantEntity.getAccountId());

        if (!visibilityWindowEntities.isEmpty()) {
            return visibilityWindowEntities.stream()
                    .anyMatch(visibilityWindowEntity -> isMessageInsideVisibilityWindow(messageEntity, visibilityWindowEntity));
        }

        if (participantEntity.getHistoryVisibleFromCreatedAt() != null
                && messageEntity.getCreatedAt().isBefore(participantEntity.getHistoryVisibleFromCreatedAt())) {
            return false;
        }

        return participantEntity.getRemovedAt() == null || !messageEntity.getCreatedAt().isAfter(participantEntity.getRemovedAt());
    }

    private boolean isMessageInsideVisibilityWindow(MessageEntity messageEntity, ChatParticipantVisibilityWindowEntity visibilityWindowEntity) {
        OffsetDateTime messageCreatedAt = messageEntity.getCreatedAt();
        OffsetDateTime visibleFromCreatedAt = visibilityWindowEntity.getVisibleFromCreatedAt();
        OffsetDateTime visibleUntilCreatedAt = visibilityWindowEntity.getVisibleUntilCreatedAt();

        if (visibleFromCreatedAt != null && messageCreatedAt.isBefore(visibleFromCreatedAt)) {
            return false;
        }

        return visibleUntilCreatedAt == null || !messageCreatedAt.isAfter(visibleUntilCreatedAt);
    }

    private MessageEntity getMessageInChat(UUID chatId, UUID messageId) {
        MessageEntity messageEntity = messageRepository.findById(messageId)
                .orElseThrow(() -> new MessageNotFoundException("Message with ID '" + messageId + "' was not found."));

        if (!messageEntity.getChatId().equals(chatId)) {
            throw new MessageNotFoundException("Message with ID '" + messageId + "' was not found in this chat.");
        }

        return messageEntity;
    }

    private List<MessageAccountKeyEnvelopeEntity> saveAccountKeyEnvelopes(
            UUID messageId,
            List<AccountKeyEnvelopeRequestDto> accountKeyEnvelopes,
            OffsetDateTime now
    ) {
        List<AccountKeyEnvelopeRequestDto> safeAccountKeyEnvelopes = accountKeyEnvelopes == null ? List.of() : accountKeyEnvelopes;
        List<MessageAccountKeyEnvelopeEntity> envelopeEntities = safeAccountKeyEnvelopes.stream()
                .map(accountKeyEnvelope -> MessageAccountKeyEnvelopeEntity.builder()
                        .messageId(messageId)
                        .targetAccountId(accountKeyEnvelope.targetAccountId())
                        .algorithm(accountKeyEnvelope.algorithm().trim())
                        .encryptedKeyBase64(accountKeyEnvelope.encryptedKeyBase64().trim())
                        .createdAt(now)
                        .build())
                .toList();
        return messageAccountKeyEnvelopeRepository.saveAll(envelopeEntities);
    }

    private List<MessageDevicePayloadEntity> saveDevicePayloads(
            UUID messageId,
            List<DeviceMessagePayloadRequestDto> devicePayloads,
            OffsetDateTime now
    ) {
        List<DeviceMessagePayloadRequestDto> safeDevicePayloads = devicePayloads == null ? List.of() : devicePayloads;
        List<MessageDevicePayloadEntity> payloadEntities = safeDevicePayloads.stream()
                .map(devicePayload -> MessageDevicePayloadEntity.builder()
                        .messageId(messageId)
                        .targetAccountId(devicePayload.targetAccountId())
                        .targetDeviceId(devicePayload.targetDeviceId())
                        .ciphertextType(devicePayload.ciphertextType())
                        .encryptedPayload(devicePayload.encryptedPayload().trim())
                        .createdAt(now)
                        .build())
                .toList();
        return messageDevicePayloadRepository.saveAll(payloadEntities);
    }

    private List<UUID> createDeliveryStates(
            MessageEntity messageEntity,
            UUID senderAccountId,
            List<ChatParticipantEntity> activeParticipants
    ) {
        List<MessageDeliveryStateEntity> deliveryStateEntities = activeParticipants.stream()
                .filter(participantEntity -> !participantEntity.getAccountId().equals(senderAccountId))
                .map(participantEntity -> MessageDeliveryStateEntity.builder()
                        .messageId(messageEntity.getId())
                        .accountId(participantEntity.getAccountId())
                        .status(MessageDeliveryStatus.SENT)
                        .build())
                .toList();
        messageDeliveryStateRepository.saveAll(deliveryStateEntities);
        return deliveryStateEntities.stream()
                .map(MessageDeliveryStateEntity::getAccountId)
                .toList();
    }

    private void markMessagesRead(UUID currentAccountId, List<UUID> readMessageIds, OffsetDateTime readAt) {
        if (readMessageIds.isEmpty()) {
            return;
        }

        List<MessageDeliveryStateEntity> deliveryStateEntities = messageDeliveryStateRepository.findByMessageIdIn(readMessageIds).stream()
                .filter(deliveryStateEntity -> deliveryStateEntity.getAccountId().equals(currentAccountId))
                .filter(deliveryStateEntity -> deliveryStateEntity.getStatus() != MessageDeliveryStatus.READ)
                .toList();

        deliveryStateEntities.forEach(deliveryStateEntity -> {
            deliveryStateEntity.setStatus(MessageDeliveryStatus.READ);
            deliveryStateEntity.setDeliveredAt(deliveryStateEntity.getDeliveredAt() == null ? readAt : deliveryStateEntity.getDeliveredAt());
            deliveryStateEntity.setReadAt(readAt);
        });
        messageDeliveryStateRepository.saveAll(deliveryStateEntities);
    }

    private ChatEntity updateChatTimestamp(ChatEntity chatEntity, OffsetDateTime now) {
        chatEntity.setUpdatedAt(now);
        return chatRepository.save(chatEntity);
    }

    private void publishChatUpdatedEvent(ChatEntity chatEntity, List<ChatParticipantEntity> activeParticipants) {
        List<ChatParticipantEntity> allParticipants = chatParticipantRepository.findByChatId(chatEntity.getId());
        List<UUID> recipientAccountIds = activeParticipants.stream()
                .map(ChatParticipantEntity::getAccountId)
                .toList();
        messagingEventPublisher.publish(messagingEventFactory.createChatUpdatedEvent(chatMapper.toChatResponse(chatEntity, allParticipants), recipientAccountIds));
    }

    private GroupEpochKeyEnvelopeEntity findGroupEpochEnvelope(MessageEntity messageEntity, UUID accountId) {
        if (messageEntity.getEncryptionType() != MessageEncryptionType.GROUP || messageEntity.getGroupKeyEpoch() == null) {
            return null;
        }

        return groupEpochKeyEnvelopeRepository
                .findByChatIdAndEpochAndTargetAccountId(messageEntity.getChatId(), messageEntity.getGroupKeyEpoch(), accountId)
                .orElse(null);
    }

    private List<MessageAccountKeyEnvelopeEntity> filterAccountKeyEnvelopesForAccount(List<MessageAccountKeyEnvelopeEntity> envelopeEntities, UUID accountId) {
        return envelopeEntities.stream()
                .filter(envelopeEntity -> envelopeEntity.getTargetAccountId().equals(accountId))
                .toList();
    }

    private List<MessageDevicePayloadEntity> filterPayloadsForAccount(List<MessageDevicePayloadEntity> payloadEntities, UUID accountId) {
        return payloadEntities.stream()
                .filter(payloadEntity -> payloadEntity.getTargetAccountId().equals(accountId))
                .toList();
    }

    private void publishMessageCreatedEvent(
            MessageEntity messageEntity,
            List<MessageDevicePayloadEntity> payloadEntities,
            List<MessageAccountKeyEnvelopeEntity> accountKeyEnvelopeEntities,
            List<UUID> recipientAccountIds
    ) {
        messagingEventPublisher.publish(messagingEventFactory.createMessageCreatedEvent(
                messageEntity,
                payloadEntities,
                accountKeyEnvelopeEntities,
                null,
                recipientAccountIds
        ));
    }


    private void publishMessageReactionUpdatedEvent(UUID chatId, UUID messageId, UUID accountId, String emoji, OffsetDateTime updatedAt) {
        List<UUID> recipientAccountIds = chatParticipantRepository.findByChatIdAndStatus(chatId, ChatParticipantStatus.ACTIVE)
                .stream()
                .map(ChatParticipantEntity::getAccountId)
                .toList();
        messagingEventPublisher.publish(messagingEventFactory.createMessageReactionUpdatedEvent(
                chatId,
                messageId,
                accountId,
                emoji,
                updatedAt,
                recipientAccountIds
        ));
    }

    private void publishMessageDeliveredEvent(MessageEntity messageEntity, UUID deliveredByAccountId) {
        List<UUID> recipientAccountIds = chatParticipantRepository.findByChatIdAndStatus(messageEntity.getChatId(), ChatParticipantStatus.ACTIVE)
                .stream()
                .map(ChatParticipantEntity::getAccountId)
                .toList();
        messagingEventPublisher.publish(messagingEventFactory.createMessageDeliveredEvent(
                messageEntity.getChatId(),
                messageEntity.getId(),
                deliveredByAccountId,
                recipientAccountIds
        ));
    }

    private void publishMessageReadEvent(
            UUID chatId,
            UUID lastReadMessageId,
            List<UUID> readMessageIds,
            UUID readByAccountId,
            OffsetDateTime readAt
    ) {
        List<UUID> recipientAccountIds = chatParticipantRepository.findByChatIdAndStatus(chatId, ChatParticipantStatus.ACTIVE)
                .stream()
                .map(ChatParticipantEntity::getAccountId)
                .toList();
        messagingEventPublisher.publish(messagingEventFactory.createMessageReadEvent(
                chatId,
                lastReadMessageId,
                readMessageIds,
                readByAccountId,
                readAt,
                recipientAccountIds
        ));
    }
}

package dev.messagingservice.service.impl;

import dev.messagingservice.exception.ChatAccessDeniedException;
import dev.messagingservice.exception.ChatNotFoundException;
import dev.messagingservice.exception.MessageNotFoundException;
import dev.messagingservice.exception.MessagePayloadValidationException;
import dev.messagingservice.model.dto.request.DeviceMessagePayloadRequestDto;
import dev.messagingservice.model.dto.request.MarkChatReadRequestDto;
import dev.messagingservice.model.dto.request.SendMessageRequestDto;
import dev.messagingservice.model.dto.response.MessageDeliveryStateResponseDto;
import dev.messagingservice.model.dto.response.MessageDevicePayloadResponseDto;
import dev.messagingservice.model.dto.response.ChatParticipantResponseDto;
import dev.messagingservice.model.dto.response.ChatParticipantVisibilityWindowResponseDto;
import dev.messagingservice.model.dto.response.ChatResponseDto;
import dev.messagingservice.model.dto.response.MessageResponseDto;
import dev.messagingservice.model.entity.ChatEntity;
import dev.messagingservice.model.entity.ChatParticipantEntity;
import dev.messagingservice.model.entity.MessageDeliveryStateEntity;
import dev.messagingservice.model.entity.ChatParticipantVisibilityWindowEntity;
import dev.messagingservice.model.entity.MessageDevicePayloadEntity;
import dev.messagingservice.model.entity.MessageEntity;
import dev.messagingservice.model.enumeration.ChatParticipantStatus;
import dev.messagingservice.model.enumeration.MessageDeliveryStatus;
import dev.messagingservice.model.enumeration.MessageEncryptionType;
import dev.messagingservice.repository.ChatParticipantRepository;
import dev.messagingservice.repository.ChatRepository;
import dev.messagingservice.repository.ChatParticipantVisibilityWindowRepository;
import dev.messagingservice.repository.MessageDeliveryStateRepository;
import dev.messagingservice.repository.MessageDevicePayloadRepository;
import dev.messagingservice.repository.MessageRepository;
import dev.messagingservice.service.MessageService;
import dev.messagingservice.service.MessagingEventFactory;
import dev.messagingservice.service.MessagingEventPublisher;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageServiceImpl implements MessageService {
    private final ChatRepository chatRepository;
    private final ChatParticipantRepository chatParticipantRepository;
    private final ChatParticipantVisibilityWindowRepository chatParticipantVisibilityWindowRepository;
    private final MessageRepository messageRepository;
    private final MessageDeliveryStateRepository messageDeliveryStateRepository;
    private final MessageDevicePayloadRepository messageDevicePayloadRepository;
    private final MessagingEventPublisher messagingEventPublisher;
    private final MessagingEventFactory messagingEventFactory;

    @Override
    @Transactional
    public MessageResponseDto sendMessage(UUID currentAccountId, UUID chatId, SendMessageRequestDto sendMessageRequestDto) {
        validateActiveParticipant(chatId, currentAccountId);

        if (sendMessageRequestDto.clientMessageId() != null && !sendMessageRequestDto.clientMessageId().trim().isEmpty()) {
            MessageEntity existingMessageEntity = messageRepository
                .findBySenderAccountIdAndClientMessageId(currentAccountId, sendMessageRequestDto.clientMessageId().trim())
                .orElse(null);

            if (existingMessageEntity != null) {
                List<MessageDeliveryStateEntity> deliveryStateEntities = messageDeliveryStateRepository.findByMessageId(existingMessageEntity.getId());
                List<MessageDevicePayloadEntity> payloadEntities = messageDevicePayloadRepository.findByMessageId(existingMessageEntity.getId());
                return mapToMessageResponseDto(existingMessageEntity, payloadEntities, deliveryStateEntities, currentAccountId);
            }
        }

        List<ChatParticipantEntity> activeParticipants = chatParticipantRepository.findByChatIdAndStatus(
            chatId,
            ChatParticipantStatus.ACTIVE
        );
        validateMessageEncryptionPayload(sendMessageRequestDto, activeParticipants);

        OffsetDateTime now = OffsetDateTime.now();
        MessageEntity messageEntity = MessageEntity.builder()
            .chatId(chatId)
            .senderAccountId(currentAccountId)
            .senderDeviceId(sendMessageRequestDto.senderDeviceId())
            .clientMessageId(trimToNull(sendMessageRequestDto.clientMessageId()))
            .messageType(sendMessageRequestDto.messageType())
            .encryptionType(sendMessageRequestDto.encryptionType())
            .encryptedPayload(trimToNull(sendMessageRequestDto.encryptedPayload()))
            .createdAt(now)
            .build();

        MessageEntity savedMessageEntity = messageRepository.save(messageEntity);
        List<MessageDevicePayloadEntity> savedPayloadEntities = saveDevicePayloads(
            savedMessageEntity.getId(),
            sendMessageRequestDto.devicePayloads() == null ? List.of() : sendMessageRequestDto.devicePayloads(),
            now
        );
        List<UUID> recipientAccountIds = createDeliveryStates(savedMessageEntity, currentAccountId, activeParticipants);
        ChatEntity updatedChatEntity = updateChatTimestamp(chatId, now);

        publishChatUpdatedEvent(updatedChatEntity, activeParticipants);
        publishMessageCreatedEvent(savedMessageEntity, savedPayloadEntities, recipientAccountIds);

        log.info("Message created. Message ID: {}, chat ID: {}.", savedMessageEntity.getId(), chatId);
        return mapToMessageResponseDto(
            savedMessageEntity,
            filterPayloadsForAccount(savedPayloadEntities, currentAccountId),
            messageDeliveryStateRepository.findByMessageId(savedMessageEntity.getId()),
            currentAccountId
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<MessageResponseDto> getChatMessages(UUID currentAccountId, UUID chatId) {
        ChatParticipantEntity currentParticipant = getKnownParticipant(chatId, currentAccountId);

        List<MessageEntity> visibleMessages = messageRepository.findByChatIdOrderByCreatedAtAsc(chatId).stream()
            .filter(messageEntity -> isVisibleToParticipant(messageEntity, currentParticipant))
            .toList();
        int firstMessageIndex = Math.max(visibleMessages.size() - 50, 0);
        List<MessageEntity> messageEntities = visibleMessages.subList(firstMessageIndex, visibleMessages.size());
        List<UUID> messageIds = messageEntities.stream()
            .map(MessageEntity::getId)
            .toList();
        Map<UUID, List<MessageDeliveryStateEntity>> deliveryStatesByMessageId = messageDeliveryStateRepository.findByMessageIdIn(messageIds).stream()
            .collect(Collectors.groupingBy(MessageDeliveryStateEntity::getMessageId));
        Map<UUID, List<MessageDevicePayloadEntity>> payloadsByMessageId = messageDevicePayloadRepository
            .findByMessageIdInAndTargetAccountId(messageIds, currentAccountId)
            .stream()
            .collect(Collectors.groupingBy(MessageDevicePayloadEntity::getMessageId));

        return messageEntities.stream()
            .map(messageEntity -> mapToMessageResponseDto(
                messageEntity,
                payloadsByMessageId.getOrDefault(messageEntity.getId(), List.of()),
                deliveryStatesByMessageId.getOrDefault(messageEntity.getId(), List.of()),
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

        if (deliveryStateEntity == null) {
            return;
        }

        if (deliveryStateEntity.getStatus() == MessageDeliveryStatus.SENT) {
            deliveryStateEntity.setStatus(MessageDeliveryStatus.DELIVERED);
            deliveryStateEntity.setDeliveredAt(OffsetDateTime.now());
            messageDeliveryStateRepository.save(deliveryStateEntity);
            publishMessageDeliveredEvent(messageEntity, currentAccountId);
        }
    }

    @Override
    @Transactional
    public void markChatRead(UUID currentAccountId, UUID chatId, MarkChatReadRequestDto markChatReadRequestDto) {
        validateActiveParticipant(chatId, currentAccountId);
        MessageEntity messageEntity = getMessageInChat(chatId, markChatReadRequestDto.messageId());
        OffsetDateTime now = OffsetDateTime.now();

        messageDeliveryStateRepository.findByMessageIdAndAccountId(messageEntity.getId(), currentAccountId)
            .ifPresent(deliveryStateEntity -> {
                if (deliveryStateEntity.getStatus() != MessageDeliveryStatus.READ) {
                    deliveryStateEntity.setStatus(MessageDeliveryStatus.READ);
                    deliveryStateEntity.setDeliveredAt(deliveryStateEntity.getDeliveredAt() == null ? now : deliveryStateEntity.getDeliveredAt());
                    deliveryStateEntity.setReadAt(now);
                    messageDeliveryStateRepository.save(deliveryStateEntity);
                }
            });

        ChatParticipantEntity participantEntity = chatParticipantRepository.findByChatIdAndAccountId(chatId, currentAccountId)
            .orElseThrow(() -> new ChatAccessDeniedException("Current account does not have access to this chat."));
        participantEntity.setLastReadMessageId(messageEntity.getId());
        participantEntity.setLastReadAt(now);
        chatParticipantRepository.save(participantEntity);
        publishMessageReadEvent(chatId, messageEntity.getId(), currentAccountId);
    }

    private void validateActiveParticipant(UUID chatId, UUID accountId) {
        boolean activeParticipantExists = chatParticipantRepository.existsByChatIdAndAccountIdAndStatus(
            chatId,
            accountId,
            ChatParticipantStatus.ACTIVE
        );

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

        if (participantEntity.getRemovedAt() != null && messageEntity.getCreatedAt().isAfter(participantEntity.getRemovedAt())) {
            return false;
        }

        return true;
    }

    private boolean isMessageInsideVisibilityWindow(
        MessageEntity messageEntity,
        ChatParticipantVisibilityWindowEntity visibilityWindowEntity
    ) {
        OffsetDateTime messageCreatedAt = messageEntity.getCreatedAt();
        OffsetDateTime visibleFromCreatedAt = visibilityWindowEntity.getVisibleFromCreatedAt();
        OffsetDateTime visibleUntilCreatedAt = visibilityWindowEntity.getVisibleUntilCreatedAt();

        if (visibleFromCreatedAt != null && messageCreatedAt.isBefore(visibleFromCreatedAt)) {
            return false;
        }

        if (visibleUntilCreatedAt != null && messageCreatedAt.isAfter(visibleUntilCreatedAt)) {
            return false;
        }

        return true;
    }

    private MessageEntity getMessageInChat(UUID chatId, UUID messageId) {
        MessageEntity messageEntity = messageRepository.findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException("Message with ID '" + messageId + "' was not found."));

        if (!messageEntity.getChatId().equals(chatId)) {
            throw new MessageNotFoundException("Message with ID '" + messageId + "' was not found in this chat.");
        }

        return messageEntity;
    }

    private void validateMessageEncryptionPayload(
        SendMessageRequestDto sendMessageRequestDto,
        List<ChatParticipantEntity> activeParticipants
    ) {
        if (sendMessageRequestDto.encryptionType() == MessageEncryptionType.NONE) {
            throw new MessagePayloadValidationException("System messages can't be sent through the public message API.");
        }

        if (sendMessageRequestDto.encryptionType() == MessageEncryptionType.GROUP) {
            if (!StringUtils.hasText(sendMessageRequestDto.encryptedPayload())) {
                throw new MessagePayloadValidationException("Group encrypted payload is required for GROUP encryption.");
            }

            List<DeviceMessagePayloadRequestDto> groupKeyDistributionPayloads = sendMessageRequestDto.devicePayloads();

            if (groupKeyDistributionPayloads == null || groupKeyDistributionPayloads.isEmpty()) {
                throw new MessagePayloadValidationException("Group key distribution payloads are required for GROUP encryption.");
            }

            validateDevicePayloads(groupKeyDistributionPayloads, activeParticipants);
            return;
        }

        List<DeviceMessagePayloadRequestDto> devicePayloads = sendMessageRequestDto.devicePayloads();

        if (devicePayloads == null || devicePayloads.isEmpty()) {
            throw new MessagePayloadValidationException("Device payloads can't be empty for SIGNAL encryption.");
        }

        validateDevicePayloads(devicePayloads, activeParticipants);
    }

    private void validateDevicePayloads(
        List<DeviceMessagePayloadRequestDto> devicePayloads,
        List<ChatParticipantEntity> activeParticipants
    ) {
        Set<UUID> activeParticipantAccountIds = activeParticipants.stream()
            .map(ChatParticipantEntity::getAccountId)
            .collect(Collectors.toSet());
        Set<UUID> targetDeviceIds = new HashSet<>();

        for (DeviceMessagePayloadRequestDto devicePayload : devicePayloads) {
            if (!activeParticipantAccountIds.contains(devicePayload.targetAccountId())) {
                throw new MessagePayloadValidationException("Device payload target account is not an active chat participant.");
            }

            if (!targetDeviceIds.add(devicePayload.targetDeviceId())) {
                throw new MessagePayloadValidationException("Duplicate device payload for target device '" + devicePayload.targetDeviceId() + "'.");
            }
        }
    }

    private List<MessageDevicePayloadEntity> saveDevicePayloads(
        UUID messageId,
        List<DeviceMessagePayloadRequestDto> devicePayloads,
        OffsetDateTime now
    ) {
        List<MessageDevicePayloadEntity> payloadEntities = devicePayloads.stream()
            .map(devicePayload -> MessageDevicePayloadEntity.builder()
                .messageId(messageId)
                .targetAccountId(devicePayload.targetAccountId())
                .targetDeviceId(devicePayload.targetDeviceId())
                .ciphertextType(devicePayload.ciphertextType())
                .encryptedPayload(devicePayload.encryptedPayload().trim())
                .createdAt(now)
                .build()
            )
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
                .build()
            )
            .toList();

        messageDeliveryStateRepository.saveAll(deliveryStateEntities);

        return deliveryStateEntities.stream()
            .map(MessageDeliveryStateEntity::getAccountId)
            .toList();
    }

    private ChatEntity updateChatTimestamp(UUID chatId, OffsetDateTime now) {
        ChatEntity chatEntity = chatRepository.findById(chatId)
            .orElseThrow(() -> new ChatNotFoundException("Chat with ID '" + chatId + "' not found."));
        chatEntity.setUpdatedAt(now);
        return chatRepository.save(chatEntity);
    }

    private void publishChatUpdatedEvent(ChatEntity chatEntity, List<ChatParticipantEntity> activeParticipants) {
        List<ChatParticipantEntity> allParticipants = chatParticipantRepository.findByChatId(chatEntity.getId());
        List<UUID> recipientAccountIds = activeParticipants.stream()
            .map(ChatParticipantEntity::getAccountId)
            .toList();

        messagingEventPublisher.publish(messagingEventFactory.createChatUpdatedEvent(
            mapToChatResponseDto(chatEntity, allParticipants),
            recipientAccountIds
        ));
    }

    private ChatResponseDto mapToChatResponseDto(ChatEntity chatEntity, List<ChatParticipantEntity> participants) {
        MessageEntity lastMessageEntity = messageRepository.findFirstByChatIdOrderByCreatedAtDesc(chatEntity.getId()).orElse(null);
        List<UUID> participantAccountIds = participants.stream()
            .filter(participantEntity -> participantEntity.getStatus() == ChatParticipantStatus.ACTIVE)
            .map(ChatParticipantEntity::getAccountId)
            .toList();
        List<ChatParticipantResponseDto> participantResponseDtos = participants.stream()
            .sorted(Comparator.comparing(ChatParticipantEntity::getJoinedAt))
            .map(this::mapToParticipantResponseDto)
            .toList();

        return new ChatResponseDto(
            chatEntity.getId(),
            chatEntity.getType(),
            chatEntity.getName(),
            chatEntity.getAvatarDataUrl(),
            chatEntity.getCurrentKeyEpoch() == null ? 1 : chatEntity.getCurrentKeyEpoch(),
            participantAccountIds,
            participantResponseDtos,
            lastMessageEntity == null ? null : lastMessageEntity.getId(),
            lastMessageEntity == null ? null : lastMessageEntity.getCreatedAt(),
            chatEntity.getCreatedAt(),
            chatEntity.getUpdatedAt()
        );
    }

    private ChatParticipantResponseDto mapToParticipantResponseDto(ChatParticipantEntity participantEntity) {
        List<ChatParticipantVisibilityWindowResponseDto> visibilityWindows = chatParticipantVisibilityWindowRepository
            .findByChatIdAndAccountIdOrderByCreatedAtAsc(participantEntity.getChatId(), participantEntity.getAccountId())
            .stream()
            .map(visibilityWindowEntity -> new ChatParticipantVisibilityWindowResponseDto(
                visibilityWindowEntity.getVisibleFromCreatedAt(),
                visibilityWindowEntity.getVisibleUntilCreatedAt()
            ))
            .toList();

        return new ChatParticipantResponseDto(
            participantEntity.getAccountId(),
            participantEntity.getRole(),
            participantEntity.getStatus(),
            participantEntity.getHistoryVisibleFromMessageId(),
            participantEntity.getHistoryVisibleFromCreatedAt(),
            participantEntity.getJoinedAt(),
            participantEntity.getRemovedAt(),
            visibilityWindows
        );
    }

    private MessageResponseDto mapToMessageResponseDto(
        MessageEntity messageEntity,
        List<MessageDevicePayloadEntity> payloadEntities,
        List<MessageDeliveryStateEntity> deliveryStateEntities,
        UUID currentAccountId
    ) {
        List<MessageDeliveryStateResponseDto> deliveryStateResponseDtos = deliveryStateEntities.stream()
            .map(deliveryStateEntity -> new MessageDeliveryStateResponseDto(
                deliveryStateEntity.getAccountId(),
                deliveryStateEntity.getStatus(),
                deliveryStateEntity.getDeliveredAt(),
                deliveryStateEntity.getReadAt()
            ))
            .toList();
        List<MessageDevicePayloadResponseDto> payloadResponseDtos = payloadEntities.stream()
            .filter(payloadEntity -> payloadEntity.getTargetAccountId().equals(currentAccountId))
            .map(this::mapToPayloadResponseDto)
            .toList();
        return new MessageResponseDto(
            messageEntity.getId(),
            messageEntity.getChatId(),
            messageEntity.getSenderAccountId(),
            messageEntity.getSenderDeviceId(),
            messageEntity.getClientMessageId(),
            messageEntity.getMessageType(),
            messageEntity.getEncryptionType(),
            messageEntity.getEncryptedPayload(),
            payloadResponseDtos,
            messageEntity.getCreatedAt(),
            deliveryStateResponseDtos
        );
    }

    private MessageDevicePayloadResponseDto mapToPayloadResponseDto(MessageDevicePayloadEntity payloadEntity) {
        return new MessageDevicePayloadResponseDto(
            payloadEntity.getTargetAccountId(),
            payloadEntity.getTargetDeviceId(),
            payloadEntity.getCiphertextType(),
            payloadEntity.getEncryptedPayload()
        );
    }

    private List<MessageDevicePayloadEntity> filterPayloadsForAccount(List<MessageDevicePayloadEntity> payloadEntities, UUID accountId) {
        return payloadEntities.stream()
            .filter(payloadEntity -> payloadEntity.getTargetAccountId().equals(accountId))
            .toList();
    }

    private void publishMessageCreatedEvent(
        MessageEntity messageEntity,
        List<MessageDevicePayloadEntity> payloadEntities,
        List<UUID> recipientAccountIds
    ) {
        messagingEventPublisher.publish(messagingEventFactory.createMessageCreatedEvent(
            messageEntity,
            payloadEntities,
            recipientAccountIds
        ));
    }

    private void publishMessageDeliveredEvent(MessageEntity messageEntity, UUID deliveredByAccountId) {
        messagingEventPublisher.publish(messagingEventFactory.createMessageDeliveredEvent(
            messageEntity.getChatId(),
            messageEntity.getId(),
            deliveredByAccountId,
            List.of(messageEntity.getSenderAccountId())
        ));
    }

    private void publishMessageReadEvent(UUID chatId, UUID lastReadMessageId, UUID readByAccountId) {
        MessageEntity messageEntity = getMessageInChat(chatId, lastReadMessageId);

        messagingEventPublisher.publish(messagingEventFactory.createMessageReadEvent(
            chatId,
            lastReadMessageId,
            readByAccountId,
            List.of(messageEntity.getSenderAccountId())
        ));
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }

        return value.trim();
    }
}

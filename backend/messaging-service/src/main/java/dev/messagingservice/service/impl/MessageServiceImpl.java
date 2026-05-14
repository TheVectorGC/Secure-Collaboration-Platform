package dev.messagingservice.service.impl;

import dev.messagingservice.exception.ChatAccessDeniedException;
import dev.messagingservice.exception.ChatNotFoundException;
import dev.messagingservice.exception.MessageNotFoundException;
import dev.messagingservice.model.dto.request.MarkChatReadRequestDto;
import dev.messagingservice.model.dto.request.SendMessageRequestDto;
import dev.messagingservice.model.dto.response.MessageDeliveryStateResponseDto;
import dev.messagingservice.model.dto.response.MessageResponseDto;
import dev.messagingservice.model.entity.ChatEntity;
import dev.messagingservice.model.entity.ChatParticipantEntity;
import dev.messagingservice.model.entity.MessageDeliveryStateEntity;
import dev.messagingservice.model.entity.MessageEntity;
import dev.messagingservice.model.enumeration.ChatParticipantStatus;
import dev.messagingservice.model.enumeration.MessageDeliveryStatus;
import dev.messagingservice.repository.ChatParticipantRepository;
import dev.messagingservice.repository.ChatRepository;
import dev.messagingservice.repository.MessageDeliveryStateRepository;
import dev.messagingservice.repository.MessageRepository;
import dev.messagingservice.service.MessageService;
import java.time.OffsetDateTime;
import java.util.Comparator;
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
    private final MessageRepository messageRepository;
    private final MessageDeliveryStateRepository messageDeliveryStateRepository;

    @Override
    @Transactional
    public MessageResponseDto sendMessage(UUID currentAccountId, UUID chatId, SendMessageRequestDto sendMessageRequestDto) {
        validateActiveParticipant(chatId, currentAccountId);

        if (sendMessageRequestDto.clientMessageId() != null && !sendMessageRequestDto.clientMessageId().trim().isEmpty()) {
            MessageEntity existingMessageEntity = messageRepository
                .findBySenderAccountIdAndClientMessageId(currentAccountId, sendMessageRequestDto.clientMessageId().trim())
                .orElse(null);

            if (existingMessageEntity != null) {
                return mapToMessageResponseDto(existingMessageEntity, messageDeliveryStateRepository.findByMessageId(existingMessageEntity.getId()));
            }
        }

        OffsetDateTime now = OffsetDateTime.now();
        MessageEntity messageEntity = MessageEntity.builder()
            .chatId(chatId)
            .senderAccountId(currentAccountId)
            .senderDeviceId(sendMessageRequestDto.senderDeviceId())
            .clientMessageId(trimToNull(sendMessageRequestDto.clientMessageId()))
            .messageType(sendMessageRequestDto.messageType())
            .encryptionType(sendMessageRequestDto.encryptionType())
            .encryptedPayload(sendMessageRequestDto.encryptedPayload().trim())
            .createdAt(now)
            .build();

        MessageEntity savedMessageEntity = messageRepository.save(messageEntity);
        createDeliveryStates(savedMessageEntity, currentAccountId, now);
        updateChatTimestamp(chatId, now);

        log.info("Message created. Message ID: {}, chat ID: {}.", savedMessageEntity.getId(), chatId);
        return mapToMessageResponseDto(savedMessageEntity, messageDeliveryStateRepository.findByMessageId(savedMessageEntity.getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<MessageResponseDto> getChatMessages(UUID currentAccountId, UUID chatId) {
        validateActiveParticipant(chatId, currentAccountId);

        List<MessageEntity> messageEntities = messageRepository.findTop50ByChatIdOrderByCreatedAtDesc(chatId).stream()
            .sorted(Comparator.comparing(MessageEntity::getCreatedAt))
            .toList();
        List<UUID> messageIds = messageEntities.stream()
            .map(MessageEntity::getId)
            .toList();
        Map<UUID, List<MessageDeliveryStateEntity>> deliveryStatesByMessageId = messageDeliveryStateRepository.findByMessageIdIn(messageIds).stream()
            .collect(Collectors.groupingBy(MessageDeliveryStateEntity::getMessageId));

        return messageEntities.stream()
            .map(messageEntity -> mapToMessageResponseDto(messageEntity, deliveryStatesByMessageId.getOrDefault(messageEntity.getId(), List.of())))
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
            .orElseThrow(() -> new MessageNotFoundException("Delivery state for message '" + messageId + "' was not found."));

        if (deliveryStateEntity.getStatus() == MessageDeliveryStatus.SENT) {
            deliveryStateEntity.setStatus(MessageDeliveryStatus.DELIVERED);
            deliveryStateEntity.setDeliveredAt(OffsetDateTime.now());
            messageDeliveryStateRepository.save(deliveryStateEntity);
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

    private MessageEntity getMessageInChat(UUID chatId, UUID messageId) {
        MessageEntity messageEntity = messageRepository.findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException("Message with ID '" + messageId + "' was not found."));

        if (!messageEntity.getChatId().equals(chatId)) {
            throw new MessageNotFoundException("Message with ID '" + messageId + "' was not found in this chat.");
        }

        return messageEntity;
    }

    private void createDeliveryStates(MessageEntity messageEntity, UUID senderAccountId, OffsetDateTime now) {
        List<ChatParticipantEntity> activeParticipants = chatParticipantRepository.findByChatIdAndStatus(
            messageEntity.getChatId(),
            ChatParticipantStatus.ACTIVE
        );
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
    }

    private void updateChatTimestamp(UUID chatId, OffsetDateTime now) {
        ChatEntity chatEntity = chatRepository.findById(chatId)
            .orElseThrow(() -> new ChatNotFoundException("Chat with ID '" + chatId + "' not found."));
        chatEntity.setUpdatedAt(now);
        chatRepository.save(chatEntity);
    }

    private MessageResponseDto mapToMessageResponseDto(MessageEntity messageEntity, List<MessageDeliveryStateEntity> deliveryStateEntities) {
        List<MessageDeliveryStateResponseDto> deliveryStateResponseDtos = deliveryStateEntities.stream()
            .map(deliveryStateEntity -> new MessageDeliveryStateResponseDto(
                deliveryStateEntity.getAccountId(),
                deliveryStateEntity.getStatus(),
                deliveryStateEntity.getDeliveredAt(),
                deliveryStateEntity.getReadAt()
            ))
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
            messageEntity.getCreatedAt(),
            deliveryStateResponseDtos
        );
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }

        return value.trim();
    }
}

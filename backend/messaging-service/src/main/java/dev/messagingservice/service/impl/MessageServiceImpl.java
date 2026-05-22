package dev.messagingservice.service.impl;

import dev.messagingservice.exception.ChatAccessDeniedException;
import dev.messagingservice.exception.ChatNotFoundException;
import dev.messagingservice.exception.MessageNotFoundException;
import dev.messagingservice.exception.MessagePayloadValidationException;
import dev.messagingservice.model.dto.request.AccountKeyEnvelopeRequestDto;
import dev.messagingservice.model.dto.request.DeviceMessagePayloadRequestDto;
import dev.messagingservice.model.dto.internal.ActiveDeviceDirectoryEntryDto;
import dev.messagingservice.model.dto.request.MarkChatReadRequestDto;
import dev.messagingservice.model.dto.request.SendMessageRequestDto;
import dev.messagingservice.model.dto.response.ChatParticipantResponseDto;
import dev.messagingservice.model.dto.response.ChatParticipantVisibilityWindowResponseDto;
import dev.messagingservice.model.dto.response.ChatResponseDto;
import dev.messagingservice.model.dto.response.AccountKeyEnvelopeResponseDto;
import dev.messagingservice.model.dto.response.MessageDeliveryStateResponseDto;
import dev.messagingservice.model.dto.response.MessageDevicePayloadResponseDto;
import dev.messagingservice.model.dto.response.MessageResponseDto;
import dev.messagingservice.model.entity.ChatEntity;
import dev.messagingservice.model.entity.ChatParticipantEntity;
import dev.messagingservice.model.entity.ChatParticipantVisibilityWindowEntity;
import dev.messagingservice.model.entity.GroupEpochKeyEnvelopeEntity;
import dev.messagingservice.model.entity.MessageAccountKeyEnvelopeEntity;
import dev.messagingservice.model.entity.MessageDeliveryStateEntity;
import dev.messagingservice.model.entity.MessageDevicePayloadEntity;
import dev.messagingservice.model.entity.MessageEntity;
import dev.messagingservice.model.enumeration.ChatParticipantStatus;
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
import dev.messagingservice.service.IdentityDeviceDirectoryClient;
import dev.messagingservice.service.MessageService;
import dev.messagingservice.service.MessagingEventFactory;
import dev.messagingservice.service.MessagingEventPublisher;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.LinkedHashSet;
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
    private final MessageAccountKeyEnvelopeRepository messageAccountKeyEnvelopeRepository;
    private final GroupEpochKeyEnvelopeRepository groupEpochKeyEnvelopeRepository;
    private final MessagingEventPublisher messagingEventPublisher;
    private final MessagingEventFactory messagingEventFactory;
    private final IdentityDeviceDirectoryClient identityDeviceDirectoryClient;

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
                List<MessageAccountKeyEnvelopeEntity> accountKeyEnvelopeEntities = messageAccountKeyEnvelopeRepository.findByMessageId(existingMessageEntity.getId());
                return mapToMessageResponseDto(existingMessageEntity, payloadEntities, accountKeyEnvelopeEntities, findGroupEpochEnvelope(existingMessageEntity, currentAccountId), deliveryStateEntities, currentAccountId);
            }
        }

        List<ChatParticipantEntity> activeParticipants = chatParticipantRepository.findByChatIdAndStatus(
                chatId,
                ChatParticipantStatus.ACTIVE
        );
        validateMessageEncryptionPayload(currentAccountId, sendMessageRequestDto, activeParticipants);

        OffsetDateTime now = OffsetDateTime.now();
        MessageEntity messageEntity = MessageEntity.builder()
                .chatId(chatId)
                .senderAccountId(currentAccountId)
                .senderDeviceId(sendMessageRequestDto.senderDeviceId())
                .clientMessageId(trimToNull(sendMessageRequestDto.clientMessageId()))
                .messageType(sendMessageRequestDto.messageType())
                .encryptionType(sendMessageRequestDto.encryptionType())
                .encryptedPayload(trimToNull(sendMessageRequestDto.encryptedPayload()))
                .contentAlgorithm(trimToNull(sendMessageRequestDto.contentAlgorithm()))
                .contentInitializationVectorBase64(trimToNull(sendMessageRequestDto.contentInitializationVectorBase64()))
                .contentAuthenticationTagBase64(trimToNull(sendMessageRequestDto.contentAuthenticationTagBase64()))
                .groupKeyEpoch(sendMessageRequestDto.groupKeyEpoch())
                .createdAt(now)
                .build();
        MessageEntity savedMessageEntity = messageRepository.save(messageEntity);
        List<MessageDevicePayloadEntity> savedPayloadEntities = saveDevicePayloads(
                savedMessageEntity.getId(),
                sendMessageRequestDto.devicePayloads() == null ? List.of() : sendMessageRequestDto.devicePayloads(),
                now
        );
        List<MessageAccountKeyEnvelopeEntity> savedAccountKeyEnvelopeEntities = saveAccountKeyEnvelopes(
                savedMessageEntity.getId(),
                sendMessageRequestDto.accountKeyEnvelopes() == null ? List.of() : sendMessageRequestDto.accountKeyEnvelopes(),
                now
        );
        List<UUID> recipientAccountIds = createDeliveryStates(savedMessageEntity, currentAccountId, activeParticipants);
        ChatEntity updatedChatEntity = updateChatTimestamp(chatId, now);

        publishChatUpdatedEvent(updatedChatEntity, activeParticipants);
        publishMessageCreatedEvent(savedMessageEntity, savedPayloadEntities, savedAccountKeyEnvelopeEntities, recipientAccountIds);
        log.info("Message created. Message ID: {}, chat ID: {}.", savedMessageEntity.getId(), chatId);

        return mapToMessageResponseDto(
                savedMessageEntity,
                filterPayloadsForAccount(savedPayloadEntities, currentAccountId),
                filterAccountKeyEnvelopesForAccount(savedAccountKeyEnvelopeEntities, currentAccountId),
                findGroupEpochEnvelope(savedMessageEntity, currentAccountId),
                messageDeliveryStateRepository.findByMessageId(savedMessageEntity.getId()),
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
        Map<UUID, List<MessageAccountKeyEnvelopeEntity>> accountKeyEnvelopesByMessageId = messageAccountKeyEnvelopeRepository
                .findByMessageIdInAndTargetAccountId(messageIds, currentAccountId)
                .stream()
                .collect(Collectors.groupingBy(MessageAccountKeyEnvelopeEntity::getMessageId));

        return messageEntities.stream()
                .map(messageEntity -> mapToMessageResponseDto(
                        messageEntity,
                        payloadsByMessageId.getOrDefault(messageEntity.getId(), List.of()),
                        accountKeyEnvelopesByMessageId.getOrDefault(messageEntity.getId(), List.of()),
                        findGroupEpochEnvelope(messageEntity, currentAccountId),
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
        ChatParticipantEntity currentParticipant = getKnownParticipant(chatId, currentAccountId);
        MessageEntity lastReadMessageEntity = getMessageInChat(chatId, markChatReadRequestDto.messageId());

        if (!isVisibleToParticipant(lastReadMessageEntity, currentParticipant)) {
            throw new MessageNotFoundException("Message with ID '" + markChatReadRequestDto.messageId() + "' was not found in this chat.");
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

        if (!readMessageIds.isEmpty()) {
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

        currentParticipant.setLastReadMessageId(lastReadMessageEntity.getId());
        currentParticipant.setLastReadAt(readAt);
        chatParticipantRepository.save(currentParticipant);
        publishMessageReadEvent(chatId, lastReadMessageEntity.getId(), readMessageIds, currentAccountId, readAt);
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
            UUID currentAccountId,
            SendMessageRequestDto sendMessageRequestDto,
            List<ChatParticipantEntity> activeParticipants
    ) {
        Map<UUID, Set<UUID>> activeDeviceIdsByAccountId = loadActiveDeviceIdsByAccountId(activeParticipants);
        Set<UUID> currentAccountActiveDeviceIds = activeDeviceIdsByAccountId.getOrDefault(currentAccountId, Set.of());

        if (!currentAccountActiveDeviceIds.contains(sendMessageRequestDto.senderDeviceId())) {
            throw new MessagePayloadValidationException("Sender device is not an active device of the current account.");
        }

        if (sendMessageRequestDto.encryptionType() == MessageEncryptionType.NONE) {
            throw new MessagePayloadValidationException("System messages can't be sent through the public message API.");
        }

        if (!StringUtils.hasText(sendMessageRequestDto.encryptedPayload())) {
            throw new MessagePayloadValidationException("Encrypted message body is required.");
        }

        if (!"AES-256-GCM".equals(sendMessageRequestDto.contentAlgorithm())) {
            throw new MessagePayloadValidationException("Content encryption algorithm must be AES-256-GCM.");
        }

        if (!StringUtils.hasText(sendMessageRequestDto.contentInitializationVectorBase64())
                || !StringUtils.hasText(sendMessageRequestDto.contentAuthenticationTagBase64())) {
            throw new MessagePayloadValidationException("Content encryption metadata is required.");
        }

        List<DeviceMessagePayloadRequestDto> devicePayloads = sendMessageRequestDto.devicePayloads() == null ? List.of() : sendMessageRequestDto.devicePayloads();

        if (sendMessageRequestDto.encryptionType() == MessageEncryptionType.CONTENT) {
            validateDevicePayloads(devicePayloads, activeDeviceIdsByAccountId);
            validateAccountKeyEnvelopes(sendMessageRequestDto.accountKeyEnvelopes(), activeDeviceIdsByAccountId.keySet());

            if (sendMessageRequestDto.groupKeyEpoch() != null) {
                throw new MessagePayloadValidationException("Direct content messages can't contain group key epoch.");
            }

            return;
        }

        if (sendMessageRequestDto.encryptionType() == MessageEncryptionType.GROUP) {
            if (sendMessageRequestDto.groupKeyEpoch() == null) {
                throw new MessagePayloadValidationException("Group key epoch is required for GROUP encryption.");
            }

            if (sendMessageRequestDto.accountKeyEnvelopes() != null && !sendMessageRequestDto.accountKeyEnvelopes().isEmpty()) {
                throw new MessagePayloadValidationException("Group messages can't contain per-message account key envelopes. Share group epoch envelopes separately.");
            }

            validateExistingGroupEpochEnvelopeCoverage(activeParticipants, sendMessageRequestDto.groupKeyEpoch());
            return;
        }
    }

    private void validateExistingGroupEpochEnvelopeCoverage(List<ChatParticipantEntity> activeParticipants, Integer groupKeyEpoch) {
        if (activeParticipants.isEmpty()) {
            throw new MessagePayloadValidationException("Group message requires active participants.");
        }

        UUID chatId = activeParticipants.get(0).getChatId();
        Set<UUID> activeAccountIds = activeParticipants.stream()
                .map(ChatParticipantEntity::getAccountId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<UUID> accountIdsWithEnvelope = groupEpochKeyEnvelopeRepository
                .findByChatIdAndEpochAndTargetAccountIdIn(chatId, groupKeyEpoch, activeAccountIds)
                .stream()
                .map(GroupEpochKeyEnvelopeEntity::getTargetAccountId)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (!accountIdsWithEnvelope.equals(activeAccountIds)) {
            Set<UUID> missingAccountIds = activeAccountIds.stream()
                    .filter(accountId -> !accountIdsWithEnvelope.contains(accountId))
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            throw new MessagePayloadValidationException("Group epoch key envelopes are missing for active participants: " + missingAccountIds + ".");
        }
    }

    private Map<UUID, Set<UUID>> loadActiveDeviceIdsByAccountId(List<ChatParticipantEntity> activeParticipants) {
        return activeParticipants.stream()
                .map(ChatParticipantEntity::getAccountId)
                .distinct()
                .collect(Collectors.toMap(
                        accountId -> accountId,
                        accountId -> loadActiveDeviceIds(accountId)
                ));
    }

    private Set<UUID> loadActiveDeviceIds(UUID accountId) {
        List<ActiveDeviceDirectoryEntryDto> activeDeviceDirectoryEntries = identityDeviceDirectoryClient.getActiveAccountDevices(accountId);
        Set<UUID> activeDeviceIds = activeDeviceDirectoryEntries.stream()
                .filter(activeDeviceDirectoryEntry -> activeDeviceDirectoryEntry.accountId() == null
                        || activeDeviceDirectoryEntry.accountId().equals(accountId))
                .map(ActiveDeviceDirectoryEntryDto::deviceId)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (activeDeviceIds.isEmpty()) {
            throw new MessagePayloadValidationException("Active chat participant has no active devices.");
        }

        return activeDeviceIds;
    }

    private void validateDevicePayloads(
            List<DeviceMessagePayloadRequestDto> devicePayloads,
            Map<UUID, Set<UUID>> activeDeviceIdsByAccountId
    ) {
        Set<DeviceAddress> expectedDeviceAddresses = activeDeviceIdsByAccountId.entrySet().stream()
                .flatMap(entry -> entry.getValue().stream().map(deviceId -> new DeviceAddress(entry.getKey(), deviceId)))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<DeviceAddress> actualDeviceAddresses = new LinkedHashSet<>();

        for (DeviceMessagePayloadRequestDto devicePayload : devicePayloads) {
            Set<UUID> activeDeviceIds = activeDeviceIdsByAccountId.get(devicePayload.targetAccountId());

            if (activeDeviceIds == null) {
                throw new MessagePayloadValidationException("Device payload target account is not an active chat participant.");
            }

            if (!activeDeviceIds.contains(devicePayload.targetDeviceId())) {
                throw new MessagePayloadValidationException("Device payload target device is not an active device of the target account.");
            }

            DeviceAddress deviceAddress = new DeviceAddress(devicePayload.targetAccountId(), devicePayload.targetDeviceId());

            if (!actualDeviceAddresses.add(deviceAddress)) {
                throw new MessagePayloadValidationException("Duplicate device payload for target device '" + devicePayload.targetDeviceId() + "'.");
            }
        }

        if (!actualDeviceAddresses.equals(expectedDeviceAddresses)) {
            Set<DeviceAddress> missingDeviceAddresses = expectedDeviceAddresses.stream()
                    .filter(expectedDeviceAddress -> !actualDeviceAddresses.contains(expectedDeviceAddress))
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            Set<DeviceAddress> unexpectedDeviceAddresses = actualDeviceAddresses.stream()
                    .filter(actualDeviceAddress -> !expectedDeviceAddresses.contains(actualDeviceAddress))
                    .collect(Collectors.toCollection(LinkedHashSet::new));

            if (!missingDeviceAddresses.isEmpty()) {
                throw new MessagePayloadValidationException("Device payloads do not cover all active chat participant devices.");
            }

            if (!unexpectedDeviceAddresses.isEmpty()) {
                throw new MessagePayloadValidationException("Device payloads contain unexpected devices.");
            }
        }
    }

    private record DeviceAddress(UUID accountId, UUID deviceId) {}

    private void validateAccountKeyEnvelopes(
            List<AccountKeyEnvelopeRequestDto> accountKeyEnvelopes,
            Set<UUID> activeAccountIds
    ) {
        if (accountKeyEnvelopes == null || accountKeyEnvelopes.isEmpty()) {
            throw new MessagePayloadValidationException("Account key envelopes can't be empty for encrypted messages.");
        }

        Set<UUID> actualAccountIds = new LinkedHashSet<>();

        for (AccountKeyEnvelopeRequestDto accountKeyEnvelope : accountKeyEnvelopes) {
            if (!activeAccountIds.contains(accountKeyEnvelope.targetAccountId())) {
                throw new MessagePayloadValidationException("Account key envelope target is not an active chat participant.");
            }

            if (!actualAccountIds.add(accountKeyEnvelope.targetAccountId())) {
                throw new MessagePayloadValidationException("Duplicate account key envelope for account '" + accountKeyEnvelope.targetAccountId() + "'.");
            }

            if (!"RSA-OAEP-SHA256".equals(accountKeyEnvelope.algorithm())) {
                throw new MessagePayloadValidationException("Account key envelope algorithm must be RSA-OAEP-SHA256.");
            }

            if (!StringUtils.hasText(accountKeyEnvelope.encryptedKeyBase64())) {
                throw new MessagePayloadValidationException("Account key envelope encrypted key is required.");
            }
        }

        if (!actualAccountIds.equals(activeAccountIds)) {
            throw new MessagePayloadValidationException("Account key envelopes do not cover all active chat participants.");
        }
    }

    private List<MessageAccountKeyEnvelopeEntity> saveAccountKeyEnvelopes(
            UUID messageId,
            List<AccountKeyEnvelopeRequestDto> accountKeyEnvelopes,
            OffsetDateTime now
    ) {
        List<MessageAccountKeyEnvelopeEntity> envelopeEntities = accountKeyEnvelopes.stream()
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
        List<MessageDevicePayloadEntity> payloadEntities = devicePayloads.stream()
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
            List<MessageAccountKeyEnvelopeEntity> accountKeyEnvelopeEntities,
            GroupEpochKeyEnvelopeEntity groupEpochKeyEnvelopeEntity,
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
        List<AccountKeyEnvelopeResponseDto> accountKeyEnvelopeResponseDtos = accountKeyEnvelopeEntities.stream()
                .filter(accountKeyEnvelopeEntity -> accountKeyEnvelopeEntity.getTargetAccountId().equals(currentAccountId))
                .map(this::mapToAccountKeyEnvelopeResponseDto)
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
                messageEntity.getContentAlgorithm(),
                messageEntity.getContentInitializationVectorBase64(),
                messageEntity.getContentAuthenticationTagBase64(),
                messageEntity.getGroupKeyEpoch(),
                payloadResponseDtos,
                accountKeyEnvelopeResponseDtos,
                groupEpochKeyEnvelopeEntity == null ? null : mapToGroupEpochKeyEnvelopeResponseDto(groupEpochKeyEnvelopeEntity),
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

    private AccountKeyEnvelopeResponseDto mapToAccountKeyEnvelopeResponseDto(MessageAccountKeyEnvelopeEntity envelopeEntity) {
        return new AccountKeyEnvelopeResponseDto(
                envelopeEntity.getTargetAccountId(),
                null,
                envelopeEntity.getAlgorithm(),
                envelopeEntity.getEncryptedKeyBase64()
        );
    }

    private AccountKeyEnvelopeResponseDto mapToGroupEpochKeyEnvelopeResponseDto(GroupEpochKeyEnvelopeEntity envelopeEntity) {
        return new AccountKeyEnvelopeResponseDto(
                envelopeEntity.getTargetAccountId(),
                envelopeEntity.getSenderDeviceId(),
                envelopeEntity.getAlgorithm(),
                envelopeEntity.getEncryptedKeyBase64()
        );
    }

    private List<MessageAccountKeyEnvelopeEntity> filterAccountKeyEnvelopesForAccount(List<MessageAccountKeyEnvelopeEntity> envelopeEntities, UUID accountId) {
        return envelopeEntities.stream()
                .filter(envelopeEntity -> envelopeEntity.getTargetAccountId().equals(accountId))
                .toList();
    }

    private GroupEpochKeyEnvelopeEntity findGroupEpochEnvelope(MessageEntity messageEntity, UUID accountId) {
        if (messageEntity.getEncryptionType() != MessageEncryptionType.GROUP || messageEntity.getGroupKeyEpoch() == null) {
            return null;
        }

        return groupEpochKeyEnvelopeRepository
                .findByChatIdAndEpochAndTargetAccountId(messageEntity.getChatId(), messageEntity.getGroupKeyEpoch(), accountId)
                .orElse(null);
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

    private void publishMessageDeliveredEvent(MessageEntity messageEntity, UUID deliveredByAccountId) {
        List<UUID> recipientAccountIds = chatParticipantRepository.findByChatIdAndStatus(
                        messageEntity.getChatId(),
                        ChatParticipantStatus.ACTIVE
                )
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
        List<UUID> recipientAccountIds = chatParticipantRepository.findByChatIdAndStatus(
                        chatId,
                        ChatParticipantStatus.ACTIVE
                )
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

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }

        return value.trim();
    }
}

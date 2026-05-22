package dev.messagingservice.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.messagingservice.exception.ChatAccessDeniedException;
import dev.messagingservice.exception.ChatNotFoundException;
import dev.messagingservice.exception.MessagePayloadValidationException;
import dev.messagingservice.model.dto.request.AddGroupParticipantRequestDto;
import dev.messagingservice.model.dto.request.CreateDirectChatRequestDto;
import dev.messagingservice.model.dto.request.CreateGroupChatRequestDto;
import dev.messagingservice.model.dto.request.UpdateGroupAvatarRequestDto;
import dev.messagingservice.model.dto.request.UpsertGroupEpochKeyEnvelopeRequestDto;
import dev.messagingservice.model.dto.response.ChatParticipantResponseDto;
import dev.messagingservice.model.dto.response.ChatParticipantVisibilityWindowResponseDto;
import dev.messagingservice.model.dto.response.AccountKeyEnvelopeResponseDto;
import dev.messagingservice.model.dto.response.ChatResponseDto;
import dev.messagingservice.model.entity.ChatEntity;
import dev.messagingservice.model.entity.ChatParticipantEntity;
import dev.messagingservice.model.entity.ChatParticipantVisibilityWindowEntity;
import dev.messagingservice.model.entity.GroupEpochKeyEnvelopeEntity;
import dev.messagingservice.model.entity.MessageEntity;
import dev.messagingservice.model.enumeration.ChatParticipantRole;
import dev.messagingservice.model.enumeration.ChatParticipantStatus;
import dev.messagingservice.model.enumeration.ChatType;
import dev.messagingservice.model.enumeration.GroupHistoryAccessMode;
import dev.messagingservice.model.enumeration.MessageEncryptionType;
import dev.messagingservice.model.enumeration.MessageType;
import dev.messagingservice.repository.ChatParticipantRepository;
import dev.messagingservice.repository.ChatParticipantVisibilityWindowRepository;
import dev.messagingservice.repository.ChatRepository;
import dev.messagingservice.repository.GroupEpochKeyEnvelopeRepository;
import dev.messagingservice.repository.MessageRepository;
import dev.messagingservice.service.ChatService;
import dev.messagingservice.service.MessagingEventFactory;
import dev.messagingservice.service.MessagingEventPublisher;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatServiceImpl implements ChatService {
    private static final UUID SYSTEM_DEVICE_ID = new UUID(0L, 0L);
    private static final int MAX_AVATAR_DATA_URL_LENGTH = 700000;

    private final ChatRepository chatRepository;
    private final ChatParticipantRepository chatParticipantRepository;
    private final ChatParticipantVisibilityWindowRepository chatParticipantVisibilityWindowRepository;
    private final MessageRepository messageRepository;
    private final GroupEpochKeyEnvelopeRepository groupEpochKeyEnvelopeRepository;
    private final MessagingEventPublisher messagingEventPublisher;
    private final MessagingEventFactory messagingEventFactory;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public ChatResponseDto createOrGetDirectChat(UUID currentAccountId, CreateDirectChatRequestDto createDirectChatRequestDto) {
        if (currentAccountId.equals(createDirectChatRequestDto.recipientAccountId())) {
            return createOrGetSelfChat(currentAccountId);
        }

        String directChatKey = createDirectChatKey(currentAccountId, createDirectChatRequestDto.recipientAccountId());

        return chatRepository.findByDirectChatKey(directChatKey)
            .map(chatEntity -> mapToChatResponseDto(chatEntity, loadActiveParticipants(chatEntity.getId())))
            .orElseGet(() -> createDirectChat(currentAccountId, createDirectChatRequestDto.recipientAccountId(), directChatKey));
    }

    @Override
    @Transactional
    public ChatResponseDto createOrGetSelfChat(UUID currentAccountId) {
        OffsetDateTime now = OffsetDateTime.now();

        int insertedRows = chatRepository.insertSelfChatIfAbsent(
            UUID.randomUUID(),
            currentAccountId,
            now
        );

        ChatEntity chatEntity = chatRepository.findBySelfAccountId(currentAccountId)
            .orElseThrow(() -> new ChatNotFoundException("Self chat for account ID '" + currentAccountId + "' not found after creation attempt."));

        if (chatEntity.getCurrentKeyEpoch() == null) {
            chatEntity.setCurrentKeyEpoch(1);
            chatRepository.save(chatEntity);
        }

        chatRepository.insertParticipantIfAbsent(
            UUID.randomUUID(),
            chatEntity.getId(),
            currentAccountId,
            ChatParticipantRole.OWNER.name(),
            ChatParticipantStatus.ACTIVE.name(),
            now
        );

        if (insertedRows > 0) {
            openVisibilityWindow(chatEntity.getId(), currentAccountId, null, now);
            log.info("Self chat created. Chat ID: {}.", chatEntity.getId());
        }

        return mapToChatResponseDto(chatEntity, loadActiveParticipants(chatEntity.getId()));
    }

    @Override
    @Transactional
    public ChatResponseDto createGroupChat(UUID currentAccountId, CreateGroupChatRequestDto createGroupChatRequestDto) {
        OffsetDateTime now = OffsetDateTime.now();
        Set<UUID> uniqueParticipantAccountIds = new LinkedHashSet<>(createGroupChatRequestDto.participantAccountIds());
        uniqueParticipantAccountIds.add(currentAccountId);

        if (uniqueParticipantAccountIds.size() < 2) {
            throw new ChatAccessDeniedException("Group chat must contain at least two accounts.");
        }

        ChatEntity chatEntity = ChatEntity.builder()
            .type(ChatType.GROUP)
            .name(createGroupChatRequestDto.name().trim())
            .currentKeyEpoch(1)
            .createdByAccountId(currentAccountId)
            .createdAt(now)
            .updatedAt(now)
            .build();

        ChatEntity savedChatEntity = chatRepository.save(chatEntity);
        List<ChatParticipantEntity> participantEntities = uniqueParticipantAccountIds.stream()
            .map(accountId -> buildParticipant(
                savedChatEntity.getId(),
                accountId,
                accountId.equals(currentAccountId) ? ChatParticipantRole.OWNER : ChatParticipantRole.MEMBER,
                now,
                null,
                null
            ))
            .toList();

        chatParticipantRepository.saveAll(participantEntities);
        participantEntities.forEach(participantEntity -> openVisibilityWindow(
            participantEntity.getChatId(),
            participantEntity.getAccountId(),
            participantEntity.getHistoryVisibleFromCreatedAt(),
            now
        ));

        List<UUID> recipientAccountIds = participantEntities.stream()
            .map(ChatParticipantEntity::getAccountId)
            .toList();
        createAndPublishSystemMessage(savedChatEntity, currentAccountId, "GROUP_CREATED", null, recipientAccountIds, now);

        List<UUID> initiallyAddedAccountIds = participantEntities.stream()
            .map(ChatParticipantEntity::getAccountId)
            .filter(accountId -> !accountId.equals(currentAccountId))
            .toList();

        for (int participantIndex = 0; participantIndex < initiallyAddedAccountIds.size(); participantIndex++) {
            createAndPublishSystemMessage(
                savedChatEntity,
                currentAccountId,
                "MEMBER_ADDED",
                initiallyAddedAccountIds.get(participantIndex),
                recipientAccountIds,
                now.plusNanos(participantIndex + 1L)
            );
        }

        ChatResponseDto chatResponseDto = mapToChatResponseDto(savedChatEntity, participantEntities);
        publishChatUpdatedEvent(chatResponseDto, recipientAccountIds);

        log.info("Group chat created. Chat ID: {}, participants: {}.", savedChatEntity.getId(), participantEntities.size());
        return chatResponseDto;
    }

    @Override
    @Transactional
    public ChatResponseDto addGroupParticipant(UUID currentAccountId, UUID chatId, AddGroupParticipantRequestDto requestDto) {
        ChatEntity chatEntity = getGroupChatForAdministration(currentAccountId, chatId);
        OffsetDateTime now = OffsetDateTime.now();
        HistoryBoundary historyBoundary = resolveHistoryBoundary(chatId, requestDto, now);
        ChatParticipantEntity participantEntity = chatParticipantRepository.findByChatIdAndAccountId(chatId, requestDto.accountId())
            .map(existingParticipant -> reactivateParticipant(existingParticipant, historyBoundary, now))
            .orElseGet(() -> buildParticipant(
                chatId,
                requestDto.accountId(),
                ChatParticipantRole.MEMBER,
                now,
                historyBoundary.historyVisibleFromMessageId(),
                historyBoundary.historyVisibleFromCreatedAt()
            ));

        chatParticipantRepository.save(participantEntity);
        updateVisibilityWindows(chatId, requestDto, historyBoundary, now);
        rotateGroupKeyEpoch(chatEntity, now);

        List<ChatParticipantEntity> participantEntities = chatParticipantRepository.findByChatId(chatId);
        List<UUID> recipientAccountIds = participantEntities.stream()
            .filter(currentParticipant -> currentParticipant.getStatus() == ChatParticipantStatus.ACTIVE)
            .map(ChatParticipantEntity::getAccountId)
            .toList();

        createAndPublishSystemMessage(chatEntity, currentAccountId, "MEMBER_ADDED", requestDto.accountId(), recipientAccountIds, now);
        ChatResponseDto chatResponseDto = mapToChatResponseDto(chatEntity, participantEntities);
        publishChatUpdatedEvent(chatResponseDto, recipientAccountIds);
        return chatResponseDto;
    }

    @Override
    @Transactional
    public ChatResponseDto removeGroupParticipant(UUID currentAccountId, UUID chatId, UUID participantAccountId) {
        ChatEntity chatEntity = getGroupChatForAdministration(currentAccountId, chatId);

        if (currentAccountId.equals(participantAccountId)) {
            throw new ChatAccessDeniedException("Group owner cannot remove themselves from the group with this operation.");
        }

        ChatParticipantEntity participantEntity = chatParticipantRepository.findByChatIdAndAccountId(chatId, participantAccountId)
            .orElseThrow(() -> new ChatAccessDeniedException("Participant is not a member of this group."));

        if (participantEntity.getStatus() != ChatParticipantStatus.ACTIVE) {
            throw new ChatAccessDeniedException("Participant is not an active member of this group.");
        }

        List<UUID> recipientAccountIdsBeforeRemoval = chatParticipantRepository.findByChatIdAndStatus(chatId, ChatParticipantStatus.ACTIVE).stream()
            .map(ChatParticipantEntity::getAccountId)
            .toList();

        OffsetDateTime now = OffsetDateTime.now();
        createAndPublishSystemMessage(chatEntity, currentAccountId, "MEMBER_REMOVED", participantAccountId, recipientAccountIdsBeforeRemoval, now);
        participantEntity.setStatus(ChatParticipantStatus.REMOVED);
        participantEntity.setRemovedAt(now);
        chatParticipantRepository.save(participantEntity);
        closeOpenVisibilityWindow(participantEntity, now);
        rotateGroupKeyEpoch(chatEntity, now);

        List<ChatParticipantEntity> participantEntities = chatParticipantRepository.findByChatId(chatId);
        List<UUID> recipientAccountIdsAfterRemoval = participantEntities.stream()
            .filter(currentParticipant -> currentParticipant.getStatus() == ChatParticipantStatus.ACTIVE || currentParticipant.getAccountId().equals(participantAccountId))
            .map(ChatParticipantEntity::getAccountId)
            .toList();
        ChatResponseDto chatResponseDto = mapToChatResponseDto(chatEntity, participantEntities);
        publishChatUpdatedEvent(chatResponseDto, recipientAccountIdsAfterRemoval);
        return chatResponseDto;
    }


    @Override
    @Transactional
    public ChatResponseDto updateGroupAvatar(UUID currentAccountId, UUID chatId, UpdateGroupAvatarRequestDto requestDto) {
        ChatEntity chatEntity = getGroupChatForAdministration(currentAccountId, chatId);
        String avatarDataUrl = normalizeAvatarDataUrl(requestDto.avatarDataUrl());
        OffsetDateTime now = OffsetDateTime.now();
        chatEntity.setAvatarDataUrl(avatarDataUrl);
        chatEntity.setUpdatedAt(now);
        ChatEntity savedChatEntity = chatRepository.save(chatEntity);

        List<ChatParticipantEntity> participantEntities = chatParticipantRepository.findByChatId(chatId);
        List<UUID> recipientAccountIds = participantEntities.stream()
            .filter(currentParticipant -> currentParticipant.getStatus() == ChatParticipantStatus.ACTIVE)
            .map(ChatParticipantEntity::getAccountId)
            .toList();
        ChatResponseDto chatResponseDto = mapToChatResponseDto(savedChatEntity, participantEntities);
        publishChatUpdatedEvent(chatResponseDto, recipientAccountIds);
        return chatResponseDto;
    }

    @Override
    @Transactional
    public void upsertGroupEpochKeyEnvelope(UUID currentAccountId, UUID chatId, UpsertGroupEpochKeyEnvelopeRequestDto requestDto) {
        ChatEntity chatEntity = getGroupChatForAdministration(currentAccountId, chatId);

        if (requestDto.epoch() > (chatEntity.getCurrentKeyEpoch() == null ? 1 : chatEntity.getCurrentKeyEpoch())) {
            throw new MessagePayloadValidationException("Group epoch envelope can't target a future epoch.");
        }

        if (!"RSA-OAEP-SHA256".equals(requestDto.algorithm().trim())) {
            throw new MessagePayloadValidationException("Group epoch key envelope algorithm must be RSA-OAEP-SHA256.");
        }

        ChatParticipantEntity targetParticipant = chatParticipantRepository.findByChatIdAndAccountId(chatId, requestDto.targetAccountId())
            .orElseThrow(() -> new ChatAccessDeniedException("Target account is not a group participant."));

        if (targetParticipant.getStatus() != ChatParticipantStatus.ACTIVE) {
            throw new ChatAccessDeniedException("Target account is not an active group participant.");
        }

        GroupEpochKeyEnvelopeEntity existingEnvelopeEntity = groupEpochKeyEnvelopeRepository
            .findByChatIdAndEpochAndTargetAccountId(chatId, requestDto.epoch(), requestDto.targetAccountId())
            .orElse(null);

        if (existingEnvelopeEntity != null) {
            boolean sameEnvelope = existingEnvelopeEntity.getAlgorithm().equals(requestDto.algorithm().trim())
                && existingEnvelopeEntity.getEncryptedKeyBase64().equals(requestDto.encryptedKeyBase64().trim());

            if (!sameEnvelope) {
                throw new MessagePayloadValidationException("Existing group epoch key envelope can't be overwritten.");
            }

            return;
        }

        OffsetDateTime now = OffsetDateTime.now();
        GroupEpochKeyEnvelopeEntity envelopeEntity = GroupEpochKeyEnvelopeEntity.builder()
            .chatId(chatId)
            .epoch(requestDto.epoch())
            .targetAccountId(requestDto.targetAccountId())
            .senderDeviceId(requestDto.senderDeviceId())
            .algorithm(requestDto.algorithm().trim())
            .encryptedKeyBase64(requestDto.encryptedKeyBase64().trim())
            .createdAt(now)
            .updatedAt(now)
            .build();
        groupEpochKeyEnvelopeRepository.save(envelopeEntity);
    }


    @Override
    @Transactional(readOnly = true)
    public AccountKeyEnvelopeResponseDto getCurrentAccountGroupEpochKeyEnvelope(UUID currentAccountId, UUID chatId, Integer epoch) {
        ChatEntity chatEntity = chatRepository.findById(chatId)
            .orElseThrow(() -> new ChatNotFoundException("Chat with ID '" + chatId + "' not found."));

        if (chatEntity.getType() != ChatType.GROUP) {
            throw new ChatAccessDeniedException("Group key envelopes are available only for group chats.");
        }

        ChatParticipantEntity currentParticipant = chatParticipantRepository.findByChatIdAndAccountId(chatId, currentAccountId)
            .orElseThrow(() -> new ChatAccessDeniedException("Current account is not a group participant."));

        if (currentParticipant.getStatus() != ChatParticipantStatus.ACTIVE) {
            throw new ChatAccessDeniedException("Current account is not an active group participant.");
        }

        GroupEpochKeyEnvelopeEntity envelopeEntity = groupEpochKeyEnvelopeRepository
            .findByChatIdAndEpochAndTargetAccountId(chatId, epoch, currentAccountId)
            .orElseThrow(() -> new ChatNotFoundException("Group epoch key envelope was not found."));

        return new AccountKeyEnvelopeResponseDto(
            envelopeEntity.getTargetAccountId(),
            envelopeEntity.getSenderDeviceId(),
            envelopeEntity.getAlgorithm(),
            envelopeEntity.getEncryptedKeyBase64()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChatResponseDto> getCurrentAccountChats(UUID currentAccountId) {
        List<ChatParticipantEntity> currentParticipants = chatParticipantRepository.findByAccountId(currentAccountId);

        return currentParticipants.stream()
            .map(ChatParticipantEntity::getChatId)
            .map(chatId -> chatRepository.findById(chatId)
                .orElseThrow(() -> new ChatNotFoundException("Chat with ID '" + chatId + "' not found.")))
            .map(chatEntity -> mapToChatResponseDto(chatEntity, loadParticipantsForResponse(chatEntity.getId())))
            .sorted(Comparator.comparing(ChatResponseDto::updatedAt).reversed())
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ChatResponseDto getChat(UUID currentAccountId, UUID chatId) {
        validateKnownParticipant(chatId, currentAccountId);
        ChatEntity chatEntity = chatRepository.findById(chatId)
            .orElseThrow(() -> new ChatNotFoundException("Chat with ID '" + chatId + "' not found."));

        return mapToChatResponseDto(chatEntity, loadParticipantsForResponse(chatId));
    }

    private ChatResponseDto createDirectChat(UUID currentAccountId, UUID recipientAccountId, String directChatKey) {
        OffsetDateTime now = OffsetDateTime.now();

        int insertedRows = chatRepository.insertDirectChatIfAbsent(
            UUID.randomUUID(),
            directChatKey,
            currentAccountId,
            now
        );

        ChatEntity chatEntity = chatRepository.findByDirectChatKey(directChatKey)
            .orElseThrow(() -> new ChatNotFoundException("Direct chat with key '" + directChatKey + "' not found after creation attempt."));

        if (chatEntity.getCurrentKeyEpoch() == null) {
            chatEntity.setCurrentKeyEpoch(1);
            chatRepository.save(chatEntity);
        }

        chatRepository.insertParticipantIfAbsent(
            UUID.randomUUID(),
            chatEntity.getId(),
            currentAccountId,
            ChatParticipantRole.MEMBER.name(),
            ChatParticipantStatus.ACTIVE.name(),
            now
        );
        chatRepository.insertParticipantIfAbsent(
            UUID.randomUUID(),
            chatEntity.getId(),
            recipientAccountId,
            ChatParticipantRole.MEMBER.name(),
            ChatParticipantStatus.ACTIVE.name(),
            now
        );

        if (insertedRows > 0) {
            openVisibilityWindow(chatEntity.getId(), currentAccountId, null, now);
            openVisibilityWindow(chatEntity.getId(), recipientAccountId, null, now);
            log.info("Direct chat created. Chat ID: {}.", chatEntity.getId());
        }

        return mapToChatResponseDto(chatEntity, loadActiveParticipants(chatEntity.getId()));
    }

    private ChatParticipantEntity buildParticipant(
        UUID chatId,
        UUID accountId,
        ChatParticipantRole role,
        OffsetDateTime joinedAt,
        UUID historyVisibleFromMessageId,
        OffsetDateTime historyVisibleFromCreatedAt
    ) {
        return ChatParticipantEntity.builder()
            .chatId(chatId)
            .accountId(accountId)
            .role(role)
            .status(ChatParticipantStatus.ACTIVE)
            .joinedAt(joinedAt)
            .historyVisibleFromMessageId(historyVisibleFromMessageId)
            .historyVisibleFromCreatedAt(historyVisibleFromCreatedAt)
            .build();
    }

    private ChatParticipantEntity reactivateParticipant(
        ChatParticipantEntity existingParticipant,
        HistoryBoundary historyBoundary,
        OffsetDateTime now
    ) {
        existingParticipant.setStatus(ChatParticipantStatus.ACTIVE);
        existingParticipant.setJoinedAt(now);
        existingParticipant.setRemovedAt(null);
        existingParticipant.setHistoryVisibleFromMessageId(historyBoundary.historyVisibleFromMessageId());
        existingParticipant.setHistoryVisibleFromCreatedAt(historyBoundary.historyVisibleFromCreatedAt());
        return existingParticipant;
    }

    private HistoryBoundary resolveHistoryBoundary(UUID chatId, AddGroupParticipantRequestDto requestDto, OffsetDateTime now) {
        if (requestDto.historyAccessMode() == GroupHistoryAccessMode.FULL_HISTORY) {
            return new HistoryBoundary(null, null);
        }

        if (requestDto.historyAccessMode() == GroupHistoryAccessMode.NEW_MESSAGES_ONLY) {
            return new HistoryBoundary(null, now);
        }

        if (requestDto.historyVisibleFromMessageId() == null) {
            throw new ChatAccessDeniedException("History boundary message is required for FROM_MESSAGE access mode.");
        }

        MessageEntity boundaryMessageEntity = messageRepository.findById(requestDto.historyVisibleFromMessageId())
            .orElseThrow(() -> new ChatNotFoundException("History boundary message was not found."));

        if (!boundaryMessageEntity.getChatId().equals(chatId)) {
            throw new ChatAccessDeniedException("History boundary message belongs to another chat.");
        }

        return new HistoryBoundary(boundaryMessageEntity.getId(), boundaryMessageEntity.getCreatedAt());
    }


    private String normalizeAvatarDataUrl(String avatarDataUrl) {
        if (avatarDataUrl == null || avatarDataUrl.trim().isEmpty()) {
            return null;
        }

        String preparedAvatarDataUrl = avatarDataUrl.trim();

        if (!preparedAvatarDataUrl.startsWith("data:image/")) {
            throw new IllegalArgumentException("Group avatar must be an image data URL.");
        }

        if (preparedAvatarDataUrl.length() > MAX_AVATAR_DATA_URL_LENGTH) {
            throw new IllegalArgumentException("Group avatar data URL is too large.");
        }

        return preparedAvatarDataUrl;
    }

    private ChatEntity getGroupChatForAdministration(UUID currentAccountId, UUID chatId) {
        ChatEntity chatEntity = chatRepository.findById(chatId)
            .orElseThrow(() -> new ChatNotFoundException("Chat with ID '" + chatId + "' not found."));

        if (chatEntity.getType() != ChatType.GROUP) {
            throw new ChatAccessDeniedException("This operation is available only for group chats.");
        }

        ChatParticipantEntity currentParticipant = chatParticipantRepository.findByChatIdAndAccountId(chatId, currentAccountId)
            .orElseThrow(() -> new ChatAccessDeniedException("Current account is not a group participant."));

        if (currentParticipant.getStatus() != ChatParticipantStatus.ACTIVE || currentParticipant.getRole() != ChatParticipantRole.OWNER) {
            throw new ChatAccessDeniedException("Only active group owner can manage participants.");
        }

        return chatEntity;
    }

    private void rotateGroupKeyEpoch(ChatEntity chatEntity, OffsetDateTime now) {
        chatEntity.setCurrentKeyEpoch((chatEntity.getCurrentKeyEpoch() == null ? 1 : chatEntity.getCurrentKeyEpoch()) + 1);
        chatEntity.setUpdatedAt(now);
        chatRepository.save(chatEntity);
    }

    private void validateKnownParticipant(UUID chatId, UUID accountId) {
        ChatParticipantEntity participantEntity = chatParticipantRepository.findByChatIdAndAccountId(chatId, accountId)
            .orElseThrow(() -> new ChatAccessDeniedException("Current account does not have access to this chat."));

        if (participantEntity.getStatus() == ChatParticipantStatus.LEFT) {
            throw new ChatAccessDeniedException("Current account does not have access to this chat.");
        }
    }

    private void updateVisibilityWindows(
        UUID chatId,
        AddGroupParticipantRequestDto requestDto,
        HistoryBoundary historyBoundary,
        OffsetDateTime now
    ) {
        if (requestDto.historyAccessMode() == GroupHistoryAccessMode.FULL_HISTORY) {
            chatParticipantVisibilityWindowRepository.deleteByChatIdAndAccountId(chatId, requestDto.accountId());
            createVisibilityWindow(chatId, requestDto.accountId(), null, null, now);
            return;
        }

        if (requestDto.historyAccessMode() == GroupHistoryAccessMode.FROM_MESSAGE) {
            chatParticipantVisibilityWindowRepository.deleteByChatIdAndAccountId(chatId, requestDto.accountId());
            createVisibilityWindow(chatId, requestDto.accountId(), historyBoundary.historyVisibleFromCreatedAt(), null, now);
            return;
        }

        openVisibilityWindow(chatId, requestDto.accountId(), historyBoundary.historyVisibleFromCreatedAt(), now);
    }

    private void openVisibilityWindow(UUID chatId, UUID accountId, OffsetDateTime visibleFromCreatedAt, OffsetDateTime now) {
        boolean openWindowExists = chatParticipantVisibilityWindowRepository
            .findFirstByChatIdAndAccountIdAndVisibleUntilCreatedAtIsNullOrderByCreatedAtDesc(chatId, accountId)
            .isPresent();

        if (openWindowExists) {
            return;
        }

        createVisibilityWindow(chatId, accountId, visibleFromCreatedAt, null, now);
    }

    private void createVisibilityWindow(
        UUID chatId,
        UUID accountId,
        OffsetDateTime visibleFromCreatedAt,
        OffsetDateTime visibleUntilCreatedAt,
        OffsetDateTime now
    ) {
        ChatParticipantVisibilityWindowEntity visibilityWindowEntity = ChatParticipantVisibilityWindowEntity.builder()
            .chatId(chatId)
            .accountId(accountId)
            .visibleFromCreatedAt(visibleFromCreatedAt)
            .visibleUntilCreatedAt(visibleUntilCreatedAt)
            .createdAt(now)
            .build();

        chatParticipantVisibilityWindowRepository.save(visibilityWindowEntity);
    }

    private void closeOpenVisibilityWindow(ChatParticipantEntity participantEntity, OffsetDateTime now) {
        ChatParticipantVisibilityWindowEntity visibilityWindowEntity = chatParticipantVisibilityWindowRepository
            .findFirstByChatIdAndAccountIdAndVisibleUntilCreatedAtIsNullOrderByCreatedAtDesc(
                participantEntity.getChatId(),
                participantEntity.getAccountId()
            )
            .orElseGet(() -> ChatParticipantVisibilityWindowEntity.builder()
                .chatId(participantEntity.getChatId())
                .accountId(participantEntity.getAccountId())
                .visibleFromCreatedAt(participantEntity.getHistoryVisibleFromCreatedAt())
                .createdAt(participantEntity.getJoinedAt())
                .build());

        visibilityWindowEntity.setVisibleUntilCreatedAt(now);
        chatParticipantVisibilityWindowRepository.save(visibilityWindowEntity);
    }

    private void createAndPublishSystemMessage(
        ChatEntity chatEntity,
        UUID actorAccountId,
        String systemEventType,
        UUID targetAccountId,
        List<UUID> recipientAccountIds,
        OffsetDateTime now
    ) {
        MessageEntity messageEntity = MessageEntity.builder()
            .chatId(chatEntity.getId())
            .senderAccountId(actorAccountId)
            .senderDeviceId(SYSTEM_DEVICE_ID)
            .clientMessageId(null)
            .messageType(MessageType.SYSTEM)
            .encryptionType(MessageEncryptionType.NONE)
            .encryptedPayload(createSystemMessagePayload(chatEntity, actorAccountId, systemEventType, targetAccountId))
            .createdAt(now)
            .build();

        MessageEntity savedMessageEntity = messageRepository.save(messageEntity);
        chatEntity.setUpdatedAt(now);
        chatRepository.save(chatEntity);

        messagingEventPublisher.publish(messagingEventFactory.createMessageCreatedEvent(
            savedMessageEntity,
            List.of(),
            List.of(),
            null,
            recipientAccountIds
        ));
    }

    private String createSystemMessagePayload(
        ChatEntity chatEntity,
        UUID actorAccountId,
        String systemEventType,
        UUID targetAccountId
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("kind", "GROUP_SYSTEM_EVENT");
        payload.put("version", 1);
        payload.put("type", systemEventType);
        payload.put("chatId", chatEntity.getId());
        payload.put("chatName", chatEntity.getName());
        payload.put("actorAccountId", actorAccountId);
        payload.put("targetAccountId", targetAccountId);

        try {
            return objectMapper.writeValueAsString(payload);
        }
        catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize system message payload.", exception);
        }
    }

    private void publishChatUpdatedEvent(ChatResponseDto chatResponseDto, List<UUID> recipientAccountIds) {
        messagingEventPublisher.publish(messagingEventFactory.createChatUpdatedEvent(chatResponseDto, recipientAccountIds));
    }

    private List<ChatParticipantEntity> loadActiveParticipants(UUID chatId) {
        return chatParticipantRepository.findByChatIdAndStatus(chatId, ChatParticipantStatus.ACTIVE);
    }

    private List<ChatParticipantEntity> loadParticipantsForResponse(UUID chatId) {
        return chatParticipantRepository.findByChatId(chatId);
    }

    private ChatResponseDto mapToChatResponseDto(ChatEntity chatEntity, List<ChatParticipantEntity> participants) {
        MessageEntity lastMessageEntity = messageRepository.findFirstByChatIdOrderByCreatedAtDesc(chatEntity.getId()).orElse(null);
        List<UUID> participantAccountIds = participants.stream()
            .filter(participantEntity -> participantEntity.getStatus() == ChatParticipantStatus.ACTIVE)
            .map(ChatParticipantEntity::getAccountId)
            .toList();
        List<ChatParticipantResponseDto> participantResponseDtos = participants.stream()
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

    private String createDirectChatKey(UUID firstAccountId, UUID secondAccountId) {
        List<String> accountIds = List.of(firstAccountId.toString(), secondAccountId.toString()).stream()
            .sorted()
            .toList();

        return accountIds.get(0) + ":" + accountIds.get(1);
    }

    private record HistoryBoundary(UUID historyVisibleFromMessageId, OffsetDateTime historyVisibleFromCreatedAt) {}
}

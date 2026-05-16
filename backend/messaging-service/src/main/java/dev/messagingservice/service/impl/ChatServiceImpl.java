package dev.messagingservice.service.impl;

import dev.messagingservice.exception.ChatAccessDeniedException;
import dev.messagingservice.exception.ChatNotFoundException;
import dev.messagingservice.model.dto.request.AddGroupParticipantRequestDto;
import dev.messagingservice.model.dto.request.CreateDirectChatRequestDto;
import dev.messagingservice.model.dto.request.CreateGroupChatRequestDto;
import dev.messagingservice.model.dto.response.ChatParticipantResponseDto;
import dev.messagingservice.model.dto.response.ChatResponseDto;
import dev.messagingservice.model.entity.ChatEntity;
import dev.messagingservice.model.entity.ChatParticipantEntity;
import dev.messagingservice.model.entity.MessageEntity;
import dev.messagingservice.model.enumeration.ChatParticipantRole;
import dev.messagingservice.model.enumeration.ChatParticipantStatus;
import dev.messagingservice.model.enumeration.ChatType;
import dev.messagingservice.model.enumeration.GroupHistoryAccessMode;
import dev.messagingservice.repository.ChatParticipantRepository;
import dev.messagingservice.repository.ChatRepository;
import dev.messagingservice.repository.MessageRepository;
import dev.messagingservice.service.ChatService;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
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
    private final ChatRepository chatRepository;
    private final ChatParticipantRepository chatParticipantRepository;
    private final MessageRepository messageRepository;

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
        log.info("Group chat created. Chat ID: {}, participants: {}.", savedChatEntity.getId(), participantEntities.size());
        return mapToChatResponseDto(savedChatEntity, participantEntities);
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
        rotateGroupKeyEpoch(chatEntity, now);
        return mapToChatResponseDto(chatEntity, chatParticipantRepository.findByChatId(chatId));
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

        OffsetDateTime now = OffsetDateTime.now();
        participantEntity.setStatus(ChatParticipantStatus.REMOVED);
        participantEntity.setRemovedAt(now);
        chatParticipantRepository.save(participantEntity);
        rotateGroupKeyEpoch(chatEntity, now);
        return mapToChatResponseDto(chatEntity, chatParticipantRepository.findByChatId(chatId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChatResponseDto> getCurrentAccountChats(UUID currentAccountId) {
        List<ChatParticipantEntity> currentParticipants = chatParticipantRepository.findByAccountIdAndStatus(
            currentAccountId,
            ChatParticipantStatus.ACTIVE
        );

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

        if (participantEntity.getStatus() != ChatParticipantStatus.ACTIVE) {
            throw new ChatAccessDeniedException("Current account does not have access to this chat.");
        }
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
        return new ChatParticipantResponseDto(
            participantEntity.getAccountId(),
            participantEntity.getRole(),
            participantEntity.getStatus(),
            participantEntity.getHistoryVisibleFromMessageId(),
            participantEntity.getHistoryVisibleFromCreatedAt(),
            participantEntity.getJoinedAt(),
            participantEntity.getRemovedAt()
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

package dev.messagingservice.service.impl;

import dev.messagingservice.exception.ChatAccessDeniedException;
import dev.messagingservice.exception.ChatNotFoundException;
import dev.messagingservice.model.dto.request.CreateDirectChatRequestDto;
import dev.messagingservice.model.dto.response.ChatResponseDto;
import dev.messagingservice.model.entity.ChatEntity;
import dev.messagingservice.model.entity.ChatParticipantEntity;
import dev.messagingservice.model.entity.MessageEntity;
import dev.messagingservice.model.enumeration.ChatParticipantRole;
import dev.messagingservice.model.enumeration.ChatParticipantStatus;
import dev.messagingservice.model.enumeration.ChatType;
import dev.messagingservice.repository.ChatParticipantRepository;
import dev.messagingservice.repository.ChatRepository;
import dev.messagingservice.repository.MessageRepository;
import dev.messagingservice.service.ChatService;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
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
        return chatRepository.findBySelfAccountId(currentAccountId)
            .map(chatEntity -> mapToChatResponseDto(chatEntity, loadActiveParticipants(chatEntity.getId())))
            .orElseGet(() -> createSelfChat(currentAccountId));
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
            .map(chatEntity -> mapToChatResponseDto(chatEntity, loadActiveParticipants(chatEntity.getId())))
            .sorted(Comparator.comparing(ChatResponseDto::updatedAt).reversed())
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ChatResponseDto getChat(UUID currentAccountId, UUID chatId) {
        validateActiveParticipant(chatId, currentAccountId);
        ChatEntity chatEntity = chatRepository.findById(chatId)
            .orElseThrow(() -> new ChatNotFoundException("Chat with ID '" + chatId + "' not found."));

        return mapToChatResponseDto(chatEntity, loadActiveParticipants(chatId));
    }

    private ChatResponseDto createDirectChat(UUID currentAccountId, UUID recipientAccountId, String directChatKey) {
        OffsetDateTime now = OffsetDateTime.now();
        ChatEntity chatEntity = ChatEntity.builder()
            .type(ChatType.DIRECT)
            .directChatKey(directChatKey)
            .createdByAccountId(currentAccountId)
            .createdAt(now)
            .updatedAt(now)
            .build();
        ChatEntity savedChatEntity = chatRepository.save(chatEntity);

        chatParticipantRepository.save(buildParticipant(savedChatEntity.getId(), currentAccountId, ChatParticipantRole.MEMBER, now));
        chatParticipantRepository.save(buildParticipant(savedChatEntity.getId(), recipientAccountId, ChatParticipantRole.MEMBER, now));

        log.info("Direct chat created. Chat ID: {}.", savedChatEntity.getId());
        return mapToChatResponseDto(savedChatEntity, loadActiveParticipants(savedChatEntity.getId()));
    }

    private ChatResponseDto createSelfChat(UUID currentAccountId) {
        OffsetDateTime now = OffsetDateTime.now();
        ChatEntity chatEntity = ChatEntity.builder()
            .type(ChatType.SELF)
            .selfAccountId(currentAccountId)
            .createdByAccountId(currentAccountId)
            .createdAt(now)
            .updatedAt(now)
            .build();
        ChatEntity savedChatEntity = chatRepository.save(chatEntity);
        chatParticipantRepository.save(buildParticipant(savedChatEntity.getId(), currentAccountId, ChatParticipantRole.OWNER, now));

        log.info("Self chat created. Chat ID: {}.", savedChatEntity.getId());
        return mapToChatResponseDto(savedChatEntity, loadActiveParticipants(savedChatEntity.getId()));
    }

    private ChatParticipantEntity buildParticipant(UUID chatId, UUID accountId, ChatParticipantRole role, OffsetDateTime joinedAt) {
        return ChatParticipantEntity.builder()
            .chatId(chatId)
            .accountId(accountId)
            .role(role)
            .status(ChatParticipantStatus.ACTIVE)
            .joinedAt(joinedAt)
            .build();
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

    private List<ChatParticipantEntity> loadActiveParticipants(UUID chatId) {
        return chatParticipantRepository.findByChatIdAndStatus(chatId, ChatParticipantStatus.ACTIVE);
    }

    private ChatResponseDto mapToChatResponseDto(ChatEntity chatEntity, List<ChatParticipantEntity> participants) {
        MessageEntity lastMessageEntity = messageRepository.findFirstByChatIdOrderByCreatedAtDesc(chatEntity.getId()).orElse(null);
        List<UUID> participantAccountIds = participants.stream()
            .map(ChatParticipantEntity::getAccountId)
            .toList();

        return new ChatResponseDto(
            chatEntity.getId(),
            chatEntity.getType(),
            participantAccountIds,
            lastMessageEntity == null ? null : lastMessageEntity.getId(),
            lastMessageEntity == null ? null : lastMessageEntity.getCreatedAt(),
            chatEntity.getCreatedAt(),
            chatEntity.getUpdatedAt()
        );
    }

    private String createDirectChatKey(UUID firstAccountId, UUID secondAccountId) {
        List<String> accountIds = List.of(firstAccountId.toString(), secondAccountId.toString()).stream()
            .sorted()
            .toList();

        return accountIds.get(0) + ":" + accountIds.get(1);
    }
}

package dev.messagingservice.mapper;

import dev.messagingservice.model.dto.response.ChatParticipantResponseDto;
import dev.messagingservice.model.dto.response.ChatParticipantVisibilityWindowResponseDto;
import dev.messagingservice.model.dto.response.ChatResponseDto;
import dev.messagingservice.model.entity.ChatEntity;
import dev.messagingservice.model.entity.ChatParticipantEntity;
import dev.messagingservice.model.entity.ChatParticipantVisibilityWindowEntity;
import dev.messagingservice.model.entity.MessageEntity;
import dev.messagingservice.model.enumeration.ChatParticipantStatus;
import dev.messagingservice.repository.ChatParticipantVisibilityWindowRepository;
import dev.messagingservice.repository.MessageRepository;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ChatMapper {
    private final MessageRepository messageRepository;
    private final ChatParticipantVisibilityWindowRepository chatParticipantVisibilityWindowRepository;

    public ChatResponseDto toChatResponse(ChatEntity chatEntity, List<ChatParticipantEntity> participants) {
        MessageEntity lastMessageEntity = messageRepository.findFirstByChatIdOrderByCreatedAtDesc(chatEntity.getId()).orElse(null);
        List<UUID> participantAccountIds = participants.stream()
                .filter(participantEntity -> participantEntity.getStatus() == ChatParticipantStatus.ACTIVE)
                .map(ChatParticipantEntity::getAccountId)
                .toList();
        List<ChatParticipantResponseDto> participantResponseDtos = participants.stream()
                .sorted(Comparator.comparing(ChatParticipantEntity::getJoinedAt))
                .map(this::toParticipantResponse)
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

    public ChatParticipantResponseDto toParticipantResponse(ChatParticipantEntity participantEntity) {
        List<ChatParticipantVisibilityWindowResponseDto> visibilityWindowResponses = chatParticipantVisibilityWindowRepository
                .findByChatIdAndAccountIdOrderByCreatedAtAsc(participantEntity.getChatId(), participantEntity.getAccountId())
                .stream()
                .map(this::toVisibilityWindowResponse)
                .toList();

        return new ChatParticipantResponseDto(
                participantEntity.getAccountId(),
                participantEntity.getRole(),
                participantEntity.getStatus(),
                participantEntity.getHistoryVisibleFromMessageId(),
                participantEntity.getHistoryVisibleFromCreatedAt(),
                participantEntity.getJoinedAt(),
                participantEntity.getRemovedAt(),
                visibilityWindowResponses
        );
    }

    private ChatParticipantVisibilityWindowResponseDto toVisibilityWindowResponse(ChatParticipantVisibilityWindowEntity visibilityWindowEntity) {
        return new ChatParticipantVisibilityWindowResponseDto(
                visibilityWindowEntity.getVisibleFromCreatedAt(),
                visibilityWindowEntity.getVisibleUntilCreatedAt()
        );
    }
}

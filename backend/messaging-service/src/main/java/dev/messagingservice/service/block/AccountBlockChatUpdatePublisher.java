package dev.messagingservice.service.block;

import dev.messagingservice.mapper.ChatMapper;
import dev.messagingservice.model.dto.response.ChatResponseDto;
import dev.messagingservice.model.entity.ChatEntity;
import dev.messagingservice.model.entity.ChatParticipantEntity;
import dev.messagingservice.repository.ChatParticipantRepository;
import dev.messagingservice.repository.ChatRepository;
import dev.messagingservice.service.MessagingEventFactory;
import dev.messagingservice.service.MessagingEventPublisher;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AccountBlockChatUpdatePublisher {
    private final ChatRepository chatRepository;
    private final ChatParticipantRepository chatParticipantRepository;
    private final ChatMapper chatMapper;
    private final MessagingEventPublisher messagingEventPublisher;
    private final MessagingEventFactory messagingEventFactory;
    private final AccountBlockService accountBlockService;

    public void publishDirectChatUpdate(UUID firstAccountId, UUID secondAccountId) {
        String directChatKey = createDirectChatKey(firstAccountId, secondAccountId);
        ChatEntity chatEntity = chatRepository.findByDirectChatKey(directChatKey).orElse(null);

        if (chatEntity == null) {
            return;
        }

        List<ChatParticipantEntity> participantEntities = chatParticipantRepository.findByChatId(chatEntity.getId());
        ChatResponseDto baseChatResponseDto = chatMapper.toChatResponse(chatEntity, participantEntities);
        publishPersonalizedChatUpdate(firstAccountId, secondAccountId, baseChatResponseDto);
        publishPersonalizedChatUpdate(secondAccountId, firstAccountId, baseChatResponseDto);
    }

    private void publishPersonalizedChatUpdate(UUID currentAccountId, UUID companionAccountId, ChatResponseDto baseChatResponseDto) {
        ChatResponseDto chatResponseDto = new ChatResponseDto(
                baseChatResponseDto.chatId(),
                baseChatResponseDto.type(),
                baseChatResponseDto.name(),
                baseChatResponseDto.avatarDataUrl(),
                baseChatResponseDto.currentKeyEpoch(),
                baseChatResponseDto.participantAccountIds(),
                baseChatResponseDto.participants(),
                baseChatResponseDto.lastMessageId(),
                baseChatResponseDto.lastMessageCreatedAt(),
                baseChatResponseDto.createdAt(),
                baseChatResponseDto.updatedAt(),
                accountBlockService.isBlockedBy(currentAccountId, companionAccountId),
                accountBlockService.isBlockedBy(companionAccountId, currentAccountId)
        );

        messagingEventPublisher.publish(messagingEventFactory.createChatUpdatedEvent(chatResponseDto, List.of(currentAccountId)));
    }

    private String createDirectChatKey(UUID firstAccountId, UUID secondAccountId) {
        List<String> accountIds = Stream.of(firstAccountId.toString(), secondAccountId.toString())
                .sorted()
                .toList();
        return accountIds.get(0) + ":" + accountIds.get(1);
    }
}

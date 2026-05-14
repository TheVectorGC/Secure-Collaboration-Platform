package dev.messagingservice.service;

import dev.messagingservice.model.dto.request.CreateDirectChatRequestDto;
import dev.messagingservice.model.dto.response.ChatResponseDto;
import java.util.List;
import java.util.UUID;

public interface ChatService {
    ChatResponseDto createOrGetDirectChat(UUID currentAccountId, CreateDirectChatRequestDto createDirectChatRequestDto);

    ChatResponseDto createOrGetSelfChat(UUID currentAccountId);

    List<ChatResponseDto> getCurrentAccountChats(UUID currentAccountId);

    ChatResponseDto getChat(UUID currentAccountId, UUID chatId);
}

package dev.messagingservice.service;

import dev.messagingservice.model.dto.request.MarkChatReadRequestDto;
import dev.messagingservice.model.dto.request.SendMessageRequestDto;
import dev.messagingservice.model.dto.request.SetMessageReactionRequestDto;
import dev.messagingservice.model.dto.response.MessageResponseDto;
import dev.messagingservice.model.dto.response.MessageReactionResponseDto;
import java.util.List;
import java.util.UUID;

public interface MessageService {
    MessageResponseDto sendMessage(UUID currentAccountId, UUID chatId, SendMessageRequestDto sendMessageRequestDto);

    List<MessageResponseDto> getChatMessages(UUID currentAccountId, UUID chatId);

    void markMessageDelivered(UUID currentAccountId, UUID chatId, UUID messageId);

    void markChatRead(UUID currentAccountId, UUID chatId, MarkChatReadRequestDto markChatReadRequestDto);

    MessageReactionResponseDto setMessageReaction(UUID currentAccountId, UUID chatId, UUID messageId, SetMessageReactionRequestDto requestDto);

    void removeMessageReaction(UUID currentAccountId, UUID chatId, UUID messageId);
}

package dev.documentservice.client;

import dev.documentservice.model.dto.response.InternalChatResponseDto;
import java.util.List;
import java.util.UUID;

public interface MessagingAccessClient {
    InternalChatResponseDto validateCurrentAccountCanAccessChat(UUID chatId);

    List<InternalChatResponseDto> getCurrentAccountChats();
}

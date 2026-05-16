package dev.mediaservice.client;

import dev.mediaservice.model.dto.response.InternalChatResponseDto;
import java.util.UUID;

public interface MessagingAccessClient {
    InternalChatResponseDto validateCurrentAccountCanAccessChat(UUID chatId);
}

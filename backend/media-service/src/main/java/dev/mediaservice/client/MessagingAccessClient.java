package dev.mediaservice.client;

import java.util.UUID;

public interface MessagingAccessClient {
    void validateCurrentAccountCanAccessChat(UUID chatId);
}

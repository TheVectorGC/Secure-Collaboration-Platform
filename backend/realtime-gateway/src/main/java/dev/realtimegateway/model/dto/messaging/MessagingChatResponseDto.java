package dev.realtimegateway.model.dto.messaging;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MessagingChatResponseDto(
        UUID chatId,
        String type,
        List<UUID> participantAccountIds
) {}

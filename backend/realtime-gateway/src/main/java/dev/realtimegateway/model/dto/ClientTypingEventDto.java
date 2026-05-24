package dev.realtimegateway.model.dto;

import java.util.UUID;

public record ClientTypingEventDto(
        String type,
        UUID chatId,
        Boolean isTyping
) {}

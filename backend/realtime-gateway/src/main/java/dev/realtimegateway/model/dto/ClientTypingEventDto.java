package dev.realtimegateway.model.dto;

import java.util.List;
import java.util.UUID;

public record ClientTypingEventDto(
    String type,
    UUID chatId,
    List<UUID> recipientAccountIds,
    Boolean isTyping
) {}

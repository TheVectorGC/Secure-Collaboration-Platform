package dev.realtimegateway.typing;

import java.util.List;
import java.util.UUID;

public record TypingRecipientsRoute(
        UUID chatId,
        String chatType,
        List<UUID> participantAccountIds
) {}

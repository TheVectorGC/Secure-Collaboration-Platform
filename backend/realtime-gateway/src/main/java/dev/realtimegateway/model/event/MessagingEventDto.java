package dev.realtimegateway.model.event;

import com.fasterxml.jackson.databind.JsonNode;
import dev.realtimegateway.model.enumeration.RealtimeEventType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record MessagingEventDto(
        UUID eventId,
        RealtimeEventType eventType,
        UUID chatId,
        UUID messageId,
        UUID senderAccountId,
        List<UUID> recipientAccountIds,
        OffsetDateTime occurredAt,
        JsonNode payload
) {}

package dev.realtimegateway.model.event;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record RealtimeDomainEventDto(
    UUID eventId,
    String eventType,
    UUID chatId,
    UUID messageId,
    UUID senderAccountId,
    List<UUID> recipientAccountIds,
    OffsetDateTime occurredAt,
    String requestId,
    JsonNode payload
) {}

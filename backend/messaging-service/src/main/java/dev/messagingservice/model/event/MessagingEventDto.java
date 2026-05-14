package dev.messagingservice.model.event;

import com.fasterxml.jackson.databind.JsonNode;
import dev.messagingservice.model.enumeration.MessagingEventType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record MessagingEventDto(
    UUID eventId,
    MessagingEventType eventType,
    UUID chatId,
    UUID messageId,
    UUID senderAccountId,
    List<UUID> recipientAccountIds,
    OffsetDateTime occurredAt,
    JsonNode payload
) {}

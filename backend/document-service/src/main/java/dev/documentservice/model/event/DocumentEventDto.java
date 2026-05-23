package dev.documentservice.model.event;

import com.fasterxml.jackson.databind.JsonNode;
import dev.documentservice.model.enumeration.DocumentEventType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record DocumentEventDto(
    UUID eventId,
    DocumentEventType eventType,
    UUID chatId,
    UUID messageId,
    UUID senderAccountId,
    List<UUID> recipientAccountIds,
    OffsetDateTime occurredAt,
    String requestId,
    JsonNode payload) {}

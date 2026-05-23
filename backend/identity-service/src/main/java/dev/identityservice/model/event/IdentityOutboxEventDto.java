package dev.identityservice.model.event;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.UUID;

public record IdentityOutboxEventDto(
    UUID eventId,
    String eventType,
    String aggregateType,
    String aggregateId,
    OffsetDateTime occurredAt,
    String requestId,
    JsonNode payload
) {}

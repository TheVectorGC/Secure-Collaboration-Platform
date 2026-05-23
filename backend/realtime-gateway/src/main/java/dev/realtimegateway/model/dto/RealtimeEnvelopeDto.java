package dev.realtimegateway.model.dto;

import com.fasterxml.jackson.databind.JsonNode;
import dev.realtimegateway.model.enumeration.RealtimeEventType;
import java.time.OffsetDateTime;
import java.util.UUID;

public record RealtimeEnvelopeDto(
        UUID eventId,
        RealtimeEventType type,
        OffsetDateTime occurredAt,
        JsonNode payload
) {}

package dev.realtimegateway.presence;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PresenceAccountStatus(
        UUID accountId,
        boolean online,
        OffsetDateTime lastSeenAt
) {}

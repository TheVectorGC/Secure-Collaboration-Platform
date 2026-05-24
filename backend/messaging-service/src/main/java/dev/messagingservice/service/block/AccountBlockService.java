package dev.messagingservice.service.block;

import java.time.OffsetDateTime;
import java.util.UUID;

public interface AccountBlockService {
    void ensureDirectMessagingAllowed(UUID firstAccountId, UUID secondAccountId);

    boolean isBlockedInEitherDirection(UUID firstAccountId, UUID secondAccountId);

    boolean isBlockedBy(UUID blockerAccountId, UUID blockedAccountId);

    void applyAccountBlocked(UUID blockerAccountId, UUID blockedAccountId, OffsetDateTime occurredAt);

    void applyAccountUnblocked(UUID blockerAccountId, UUID blockedAccountId);
}

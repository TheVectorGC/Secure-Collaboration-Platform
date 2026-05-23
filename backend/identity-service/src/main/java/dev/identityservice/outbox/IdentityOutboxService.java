package dev.identityservice.outbox;

import java.util.UUID;

public interface IdentityOutboxService {
    void enqueueAccountBlocked(UUID blockerAccountId, UUID blockedAccountId);

    void enqueueAccountUnblocked(UUID blockerAccountId, UUID blockedAccountId);

    void enqueueDeviceRevoked(UUID accountId, UUID deviceId);
}

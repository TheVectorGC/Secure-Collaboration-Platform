package dev.identityservice.outbox;

import dev.identityservice.model.dto.response.AccountProfileResponseDto;
import java.util.UUID;

public interface IdentityOutboxService {
    void enqueueAccountBlocked(UUID blockerAccountId, UUID blockedAccountId);

    void enqueueAccountUnblocked(UUID blockerAccountId, UUID blockedAccountId);

    void enqueueDeviceRevoked(UUID accountId, UUID deviceId);

    void enqueueProfileUpdated(AccountProfileResponseDto profileResponseDto);
}

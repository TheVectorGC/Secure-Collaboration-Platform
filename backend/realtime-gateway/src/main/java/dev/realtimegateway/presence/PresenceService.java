package dev.realtimegateway.presence;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface PresenceService {
    void markOnline(UUID accountId);

    void markOffline(UUID accountId);

    List<PresenceAccountStatus> getOnlineAccounts();

    OffsetDateTime getLastSeenAt(UUID accountId);
}

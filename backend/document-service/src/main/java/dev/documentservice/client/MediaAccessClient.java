package dev.documentservice.client;

import java.util.Collection;
import java.util.UUID;

public interface MediaAccessClient {
    void grantMediaAccess(UUID mediaFileId, Collection<UUID> accountIds);
}

package dev.realtimegateway.typing;

import dev.realtimegateway.security.AccountPrincipal;
import java.util.List;
import java.util.UUID;

public interface TypingRecipientsResolver {
    List<UUID> resolveRecipientAccountIds(UUID chatId, AccountPrincipal accountPrincipal);

    void invalidateChat(UUID chatId);
}

package dev.messagingservice.service.internal;

import java.util.List;
import java.util.UUID;

public interface ProfileUpdateRecipientsService {
    List<UUID> getRecipientAccountIds(UUID accountId);
}

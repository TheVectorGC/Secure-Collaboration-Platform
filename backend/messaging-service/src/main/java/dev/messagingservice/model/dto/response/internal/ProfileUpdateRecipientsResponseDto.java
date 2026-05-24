package dev.messagingservice.model.dto.response.internal;

import java.util.List;
import java.util.UUID;

public record ProfileUpdateRecipientsResponseDto(
    UUID accountId,
    List<UUID> recipientAccountIds
) {
}

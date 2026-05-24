package dev.realtimegateway.model.dto.internal;

import java.util.List;
import java.util.UUID;

public record ProfileUpdateRecipientsResponseDto(
    UUID accountId,
    List<UUID> recipientAccountIds
) {
}

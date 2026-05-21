package dev.documentservice.model.dto.response;

import dev.documentservice.model.enumeration.DocumentObserverRole;
import java.time.OffsetDateTime;
import java.util.UUID;

public record DocumentObserverResponseDto(
    UUID observerId,
    UUID documentId,
    UUID observerAccountId,
    DocumentObserverRole role,
    OffsetDateTime createdAt
) {
}

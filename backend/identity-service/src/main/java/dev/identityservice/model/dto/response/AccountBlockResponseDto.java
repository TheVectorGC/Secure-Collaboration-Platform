package dev.identityservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Account block relationship returned by the identity service.")
public record AccountBlockResponseDto(
        @Schema(description = "Block record ID.")
        UUID blockId,

        @Schema(description = "Account ID that owns the block.")
        UUID blockerAccountId,

        @Schema(description = "Blocked account ID.")
        UUID blockedAccountId,

        @Schema(description = "Creation time.")
        OffsetDateTime createdAt
) {}

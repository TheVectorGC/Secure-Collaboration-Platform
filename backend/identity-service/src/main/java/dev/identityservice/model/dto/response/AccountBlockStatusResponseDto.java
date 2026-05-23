package dev.identityservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Block status between the current account and another account.")
public record AccountBlockStatusResponseDto(
        @Schema(description = "Current account ID.")
        UUID blockerAccountId,

        @Schema(description = "Checked account ID.")
        UUID blockedAccountId,

        @Schema(description = "Whether the checked account is blocked by current account.")
        boolean blocked
) {}

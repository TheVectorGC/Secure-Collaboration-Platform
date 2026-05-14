package dev.messagingservice.model.dto.response;

import dev.messagingservice.model.enumeration.MessageDeliveryStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Response DTO for message delivery state.")
public record MessageDeliveryStateResponseDto(
    @Schema(description = "Account ID.")
    UUID accountId,

    @Schema(description = "Delivery status.")
    MessageDeliveryStatus status,

    @Schema(description = "Delivered datetime.")
    OffsetDateTime deliveredAt,

    @Schema(description = "Read datetime.")
    OffsetDateTime readAt
) {}

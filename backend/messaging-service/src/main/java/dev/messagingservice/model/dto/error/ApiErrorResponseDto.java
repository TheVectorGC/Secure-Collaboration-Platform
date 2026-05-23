package dev.messagingservice.model.dto.error;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;

@Schema(description = "Standard API error response.")
public record ApiErrorResponseDto(
        @Schema(description = "Error timestamp.")
        OffsetDateTime timestamp,

        @Schema(description = "Request correlation identifier.")
        String requestId,

        @Schema(description = "HTTP status code.", example = "400")
        int status,

        @Schema(description = "Stable application error code.", example = "VALIDATION_FAILED")
        String code,

        @Schema(description = "Human-readable error message.")
        String message,

        @Schema(description = "Request path.")
        String path,

        @Schema(description = "Validation errors. Present only for validation failures.")
        List<FieldErrorResponseDto> fieldErrors
) {}

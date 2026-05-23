package dev.identityservice.model.dto.error;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;

@Schema(description = "Standard Vector API error response.")
public record ApiErrorResponseDto(
        @Schema(description = "Error timestamp.")
        OffsetDateTime timestamp,

        @Schema(description = "Request correlation ID.", example = "0f3b2c9d-5a12-4df4-94b9-61e6e142e6f1")
        String requestId,

        @Schema(description = "HTTP status code.", example = "400")
        int status,

        @Schema(description = "Machine-readable error code.", example = "VALIDATION_FAILED")
        String code,

        @Schema(description = "Human-readable error message.", example = "Request validation failed.")
        String message,

        @Schema(description = "Request path.", example = "/api/v1/auth/login")
        String path,

        @Schema(description = "Field-level validation errors. Present only for validation failures.")
        List<FieldErrorResponseDto> fieldErrors
) {}

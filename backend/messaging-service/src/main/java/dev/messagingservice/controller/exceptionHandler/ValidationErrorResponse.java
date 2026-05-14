package dev.messagingservice.controller.exceptionHandler;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record ValidationErrorResponse(
    @Schema(description = "Short error type.")
    String error,

    @Schema(description = "Map of field names to validation errors.")
    Map<String, List<String>> validationErrors,

    @Schema(description = "Timestamp when the error occurred.")
    LocalDateTime timestamp,

    @Schema(description = "HTTP status code of the error response.")
    int status
) {}

package dev.cryptoservice.controller.exceptionHandler;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record ValidationErrorResponse(
    @Schema(description = "Short error type.", example = "Validation Error")
    String error,

    @Schema(description = "Map of field names to lists of validation error messages.")
    Map<String, List<String>> validationErrors,

    @Schema(description = "Timestamp when the error occurred.", example = "2026-05-13T10:12:08.116245")
    LocalDateTime timestamp,

    @Schema(description = "HTTP status code of the error response.", example = "400")
    int status
) {}

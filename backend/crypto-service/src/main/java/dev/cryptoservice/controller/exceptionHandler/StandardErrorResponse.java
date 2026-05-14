package dev.cryptoservice.controller.exceptionHandler;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

@Schema(description = "Standard error response format for API exceptions.")
public record StandardErrorResponse(
    @Schema(description = "Short error type.", example = "RuntimeException")
    String error,

    @Schema(description = "Detailed error message.", example = "An internal server error occurred.")
    String message,

    @Schema(description = "Timestamp when the error occurred.", example = "2026-05-13T10:12:08.116245")
    LocalDateTime timestamp,

    @Schema(description = "HTTP status code of the error response.", example = "500")
    int status
) {}

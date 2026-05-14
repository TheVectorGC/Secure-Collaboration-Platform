package dev.messagingservice.controller.exceptionHandler;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

@Schema(description = "Standard error response format for API exceptions.")
public record StandardErrorResponse(
    @Schema(description = "Short error type.")
    String error,

    @Schema(description = "Detailed error message.")
    String message,

    @Schema(description = "Timestamp when the error occurred.")
    LocalDateTime timestamp,

    @Schema(description = "HTTP status code of the error response.")
    int status
) {}

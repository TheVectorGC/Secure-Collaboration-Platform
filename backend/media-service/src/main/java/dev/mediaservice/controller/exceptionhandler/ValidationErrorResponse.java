package dev.mediaservice.controller.exceptionhandler;

import java.time.OffsetDateTime;
import java.util.List;

public record ValidationErrorResponse(
    OffsetDateTime timestamp,
    int status,
    String error,
    String message,
    String path,
    List<String> validationErrors
) {}

package dev.documentservice.controller.exceptionhandler;

import java.time.OffsetDateTime;
import java.util.List;

public record ValidationErrorResponse(
    OffsetDateTime timestamp,
    int status,
    String error,
    String message,
    List<String> validationErrors
) {}

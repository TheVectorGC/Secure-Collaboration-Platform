package dev.documentservice.controller.exceptionhandler;

import java.time.OffsetDateTime;

public record StandardErrorResponse(
    OffsetDateTime timestamp,
    int status,
    String error,
    String message
) {}

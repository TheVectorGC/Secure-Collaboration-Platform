package dev.mediaservice.controller.exceptionhandler;

import java.time.OffsetDateTime;

public record StandardErrorResponse(
    OffsetDateTime timestamp,
    int status,
    String error,
    String message,
    String path
) {}

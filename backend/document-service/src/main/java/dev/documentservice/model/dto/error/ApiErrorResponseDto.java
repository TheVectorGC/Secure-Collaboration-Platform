package dev.documentservice.model.dto.error;

import java.time.OffsetDateTime;
import java.util.List;

public record ApiErrorResponseDto(
    OffsetDateTime timestamp,
    String requestId,
    int status,
    String code,
    String message,
    String path,
    List<FieldErrorResponseDto> fieldErrors
) {}

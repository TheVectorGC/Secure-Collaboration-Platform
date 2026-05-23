package dev.mediaservice.model.dto.error;

public record FieldErrorResponseDto(
    String field,
    String code,
    String message
) {}

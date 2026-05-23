package dev.mediaservice.model.dto.response;

public record FieldErrorResponseDto(
    String field,
    String code,
    String message
) {}

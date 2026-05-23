package dev.cryptoservice.model.dto.error;

public record FieldErrorResponseDto(
    String field,
    String code,
    String message
) {
}

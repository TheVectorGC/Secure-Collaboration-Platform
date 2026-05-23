package dev.messagingservice.model.dto.error;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Field-level validation failure.")
public record FieldErrorResponseDto(
        @Schema(description = "Request field name.", example = "encryptedPayload")
        String field,

        @Schema(description = "Stable validation code.", example = "VALIDATION_ERROR")
        String code,

        @Schema(description = "Human-readable validation message.", example = "Encrypted message body can't be empty.")
        String message
) {}

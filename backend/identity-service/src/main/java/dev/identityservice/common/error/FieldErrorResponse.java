package dev.identityservice.common.error;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Field-level validation error returned by Vector APIs.")
public record FieldErrorResponse(
        @Schema(description = "Validated field name.", example = "password")
        String field,

        @Schema(description = "Machine-readable validation code.", example = "Size")
        String code,

        @Schema(description = "Human-readable validation message.", example = "Password length must be between 12 and 128.")
        String message
) {}

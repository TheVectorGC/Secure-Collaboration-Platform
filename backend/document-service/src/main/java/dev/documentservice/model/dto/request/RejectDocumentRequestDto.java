package dev.documentservice.model.dto.request;

import jakarta.validation.constraints.Size;

public record RejectDocumentRequestDto(
    @Size(max = 1000, message = "Rejection reason is too long.")
    String reason
) {}

package dev.documentservice.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterDocumentSigningKeyRequestDto(
    @NotBlank(message = "Public signing key is required.")
    @Size(max = 10000, message = "Public signing key is too long.")
    String publicKeyBase64
) {}

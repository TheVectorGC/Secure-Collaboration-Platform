package dev.documentservice.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record DocumentFileEncryptionRequestDto(
    @NotBlank(message = "File encryption algorithm is required.")
    @Pattern(regexp = "AES-256-GCM", message = "Unsupported file encryption algorithm.")
    String algorithm,
    @NotBlank(message = "File encryption key is required.")
    @Size(max = 512, message = "File encryption key is too long.")
    String keyBase64,
    @NotBlank(message = "File initialization vector is required.")
    @Size(max = 512, message = "File initialization vector is too long.")
    String initializationVectorBase64) {}

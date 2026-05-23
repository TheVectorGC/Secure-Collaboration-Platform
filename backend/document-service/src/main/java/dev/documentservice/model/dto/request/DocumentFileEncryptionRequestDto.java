package dev.documentservice.model.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record DocumentFileEncryptionRequestDto(
    @NotBlank(message = "File encryption algorithm is required.")
    @Pattern(regexp = "AES-256-GCM", message = "Unsupported file encryption algorithm.")
    String algorithm,
    @NotBlank(message = "File initialization vector is required.")
    @Size(max = 512, message = "File initialization vector is too long.")
    String initializationVectorBase64,
    @Valid
    @NotEmpty(message = "At least one document key envelope is required.")
    List<DocumentKeyEnvelopeRequestDto> keyEnvelopes
) {}

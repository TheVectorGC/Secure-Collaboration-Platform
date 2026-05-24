package dev.documentservice.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record DocumentKeyEnvelopeRequestDto(
    @NotNull(message = "Target account ID is required.")
    UUID targetAccountId,
    UUID targetDeviceId,
    @NotBlank(message = "Document key envelope algorithm is required.")
    @Size(max = 64, message = "Document key envelope algorithm is too long.")
    @Pattern(regexp = "RSA-OAEP-SHA256", message = "Unsupported document key envelope algorithm.")
    String algorithm,
    @NotBlank(message = "Encrypted document key is required.")
    String encryptedKeyBase64
) {}

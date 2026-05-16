package dev.documentservice.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record SignDocumentRequestDto(
    @NotNull(message = "Signer device ID is required.")
    UUID signerDeviceId,

    @NotBlank(message = "Signing key fingerprint is required.")
    @Size(max = 128, message = "Signing key fingerprint is too long.")
    String signingKeyFingerprint,

    @NotBlank(message = "Document hash is required.")
    @Size(max = 64, message = "Document hash is too long.")
    String documentHashBase64,

    @NotBlank(message = "Signature is required.")
    @Size(max = 10000, message = "Signature is too long.")
    String signatureBase64
) {}

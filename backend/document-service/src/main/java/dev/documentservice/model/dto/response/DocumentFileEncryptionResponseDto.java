package dev.documentservice.model.dto.response;

import java.util.List;

public record DocumentFileEncryptionResponseDto(
    String algorithm,
    String initializationVectorBase64,
    List<DocumentKeyEnvelopeResponseDto> keyEnvelopes
) {}

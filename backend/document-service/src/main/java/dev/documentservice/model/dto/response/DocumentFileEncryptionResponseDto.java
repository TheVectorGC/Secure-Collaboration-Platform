package dev.documentservice.model.dto.response;

public record DocumentFileEncryptionResponseDto(
    String algorithm,
    String keyBase64,
    String initializationVectorBase64) {}

package dev.documentservice.service;

import dev.documentservice.model.dto.request.RegisterDocumentSigningKeyRequestDto;
import dev.documentservice.model.dto.response.DocumentSigningKeyResponseDto;
import java.util.UUID;

public interface DocumentSigningKeyService {
    DocumentSigningKeyResponseDto registerSigningKey(UUID currentAccountId, UUID deviceId, RegisterDocumentSigningKeyRequestDto requestDto);
}

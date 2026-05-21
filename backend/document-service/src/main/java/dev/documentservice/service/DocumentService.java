package dev.documentservice.service;

import dev.documentservice.model.dto.request.CreateDocumentRequestDto;
import dev.documentservice.model.dto.request.RejectDocumentRequestDto;
import dev.documentservice.model.dto.request.SignDocumentRequestDto;
import dev.documentservice.model.dto.response.DocumentResponseDto;
import java.util.List;
import java.util.UUID;

public interface DocumentService {
    DocumentResponseDto createDocument(UUID currentAccountId, CreateDocumentRequestDto requestDto);

    DocumentResponseDto getDocument(UUID currentAccountId, UUID documentId);

    List<DocumentResponseDto> getCurrentAccountDocuments(UUID currentAccountId);

    List<DocumentResponseDto> getChatDocuments(UUID currentAccountId, UUID chatId);

    DocumentResponseDto signDocument(UUID currentAccountId, UUID documentId, SignDocumentRequestDto requestDto);

    DocumentResponseDto rejectDocument(UUID currentAccountId, UUID documentId, RejectDocumentRequestDto requestDto);

    DocumentResponseDto cancelDocument(UUID currentAccountId, UUID documentId, RejectDocumentRequestDto requestDto);

    void hideDocument(UUID currentAccountId, UUID documentId);
}

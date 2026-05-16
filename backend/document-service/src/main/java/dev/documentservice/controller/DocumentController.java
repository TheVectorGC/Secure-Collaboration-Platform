package dev.documentservice.controller;

import dev.documentservice.model.dto.request.CreateDocumentRequestDto;
import dev.documentservice.model.dto.request.SignDocumentRequestDto;
import dev.documentservice.model.dto.response.DocumentResponseDto;
import dev.documentservice.service.CurrentAccountService;
import dev.documentservice.service.DocumentService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/documents")
@SecurityRequirement(name = "bearerAuth")
public class DocumentController {
    private final DocumentService documentService;
    private final CurrentAccountService currentAccountService;

    @PostMapping
    public ResponseEntity<DocumentResponseDto> createDocument(@Valid @RequestBody CreateDocumentRequestDto requestDto) {
        return new ResponseEntity<>(
                documentService.createDocument(currentAccountService.getCurrentAccountId(), requestDto),
                HttpStatus.CREATED
        );
    }

    @GetMapping
    public ResponseEntity<List<DocumentResponseDto>> getCurrentAccountDocuments() {
        return ResponseEntity.ok(documentService.getCurrentAccountDocuments(currentAccountService.getCurrentAccountId()));
    }

    @GetMapping("/{documentId}")
    public ResponseEntity<DocumentResponseDto> getDocument(@PathVariable UUID documentId) {
        return ResponseEntity.ok(documentService.getDocument(currentAccountService.getCurrentAccountId(), documentId));
    }

    @PostMapping("/{documentId}/signatures")
    public ResponseEntity<DocumentResponseDto> signDocument(
        @PathVariable UUID documentId,
        @Valid @RequestBody SignDocumentRequestDto requestDto
    ) {
        return ResponseEntity.ok(documentService.signDocument(currentAccountService.getCurrentAccountId(), documentId, requestDto));
    }

    @PatchMapping("/{documentId}/reject")
    public ResponseEntity<DocumentResponseDto> rejectDocument(@PathVariable UUID documentId) {
        return ResponseEntity.ok(documentService.rejectDocument(currentAccountService.getCurrentAccountId(), documentId));
    }
}

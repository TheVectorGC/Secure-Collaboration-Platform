package dev.documentservice.controller;

import dev.documentservice.model.dto.response.DocumentResponseDto;
import dev.documentservice.service.CurrentAccountService;
import dev.documentservice.service.DocumentService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/chats/{chatId}/documents")
@SecurityRequirement(name = "bearerAuth")
public class ChatDocumentController {
    private final DocumentService documentService;
    private final CurrentAccountService currentAccountService;

    @GetMapping
    public ResponseEntity<List<DocumentResponseDto>> getChatDocuments(@PathVariable UUID chatId) {
        return ResponseEntity.ok(documentService.getChatDocuments(currentAccountService.getCurrentAccountId(), chatId));
    }
}

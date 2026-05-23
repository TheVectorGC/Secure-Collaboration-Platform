package dev.documentservice.controller;

import dev.documentservice.model.dto.response.DocumentResponseDto;
import dev.documentservice.service.CurrentAccountService;
import dev.documentservice.service.DocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Chat Documents", description = "Document workflows connected to encrypted chat history.")
public class ChatDocumentController {
    private final DocumentService documentService;
    private final CurrentAccountService currentAccountService;

    @GetMapping
    @Operation(summary = "List chat documents", description = "Returns documents visible to the current account inside the selected chat history window.")
    @ApiResponse(responseCode = "200", description = "Chat documents were loaded.")
    public ResponseEntity<List<DocumentResponseDto>> getChatDocuments(@PathVariable UUID chatId) {
        return ResponseEntity.ok(documentService.getChatDocuments(currentAccountService.getCurrentAccountId(), chatId));
    }
}

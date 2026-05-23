package dev.documentservice.controller;

import dev.documentservice.model.dto.request.AddDocumentObserversRequestDto;
import dev.documentservice.model.dto.request.CreateDocumentRequestDto;
import dev.documentservice.model.dto.request.RejectDocumentRequestDto;
import dev.documentservice.model.dto.request.SignDocumentRequestDto;
import dev.documentservice.model.dto.response.DocumentResponseDto;
import dev.documentservice.service.CurrentAccountService;
import dev.documentservice.service.DocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/documents")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Documents", description = "Encrypted document workflows, signatures, observers and personal visibility state.")
public class DocumentController {
    private final DocumentService documentService;
    private final CurrentAccountService currentAccountService;

    @PostMapping
    @Operation(summary = "Create document workflow", description = "Registers an encrypted document, required signers, observers and encrypted document key envelopes for all accounts that should access it.")
    @ApiResponse(responseCode = "200", description = "Document workflow was created.")
    public ResponseEntity<DocumentResponseDto> createDocument(@Valid @RequestBody CreateDocumentRequestDto requestDto) {
        return ResponseEntity.ok(documentService.createDocument(currentAccountService.getCurrentAccountId(), requestDto));
    }

    @GetMapping
    @Operation(summary = "List current account documents", description = "Returns documents owned by, assigned to or observed by the current account.")
    @ApiResponse(responseCode = "200", description = "Documents were loaded.")
    public ResponseEntity<List<DocumentResponseDto>> getCurrentAccountDocuments(@RequestParam(name = "includeHidden", defaultValue = "false") boolean includeHidden) {
        return ResponseEntity.ok(documentService.getCurrentAccountDocuments(currentAccountService.getCurrentAccountId(), includeHidden));
    }

    @GetMapping("/{documentId}")
    @Operation(summary = "Get document workflow", description = "Returns a document workflow when the current account has owner, signer, observer or chat-history based access.")
    @ApiResponse(responseCode = "200", description = "Document was loaded.")
    public ResponseEntity<DocumentResponseDto> getDocument(@PathVariable UUID documentId) {
        return ResponseEntity.ok(documentService.getDocument(currentAccountService.getCurrentAccountId(), documentId));
    }

    @PostMapping("/{documentId}/signatures")
    @Operation(summary = "Sign document", description = "Verifies an Ed25519 signature from the current account device and records the document signature.")
    @ApiResponse(responseCode = "200", description = "Document signature was accepted.")
    public ResponseEntity<DocumentResponseDto> signDocument(@PathVariable UUID documentId, @Valid @RequestBody SignDocumentRequestDto requestDto) {
        return ResponseEntity.ok(documentService.signDocument(currentAccountService.getCurrentAccountId(), documentId, requestDto));
    }

    @PatchMapping("/{documentId}/reject")
    @Operation(summary = "Reject document", description = "Rejects a pending document workflow on behalf of the current required signer.")
    @ApiResponse(responseCode = "200", description = "Document was rejected.")
    public ResponseEntity<DocumentResponseDto> rejectDocument(@PathVariable UUID documentId, @Valid @RequestBody RejectDocumentRequestDto requestDto) {
        return ResponseEntity.ok(documentService.rejectDocument(currentAccountService.getCurrentAccountId(), documentId, requestDto));
    }

    @PatchMapping("/{documentId}/cancel")
    @Operation(summary = "Cancel document", description = "Cancels an unfinished document workflow owned by the current account.")
    @ApiResponse(responseCode = "200", description = "Document was cancelled.")
    public ResponseEntity<DocumentResponseDto> cancelDocument(@PathVariable UUID documentId, @Valid @RequestBody RejectDocumentRequestDto requestDto) {
        return ResponseEntity.ok(documentService.cancelDocument(currentAccountService.getCurrentAccountId(), documentId, requestDto));
    }

    @PostMapping("/{documentId}/observers")
    @Operation(summary = "Add document observers", description = "Adds observer accounts to an existing document workflow and grants media access to the encrypted file.")
    @ApiResponse(responseCode = "200", description = "Observers were added.")
    public ResponseEntity<DocumentResponseDto> addObservers(@PathVariable UUID documentId, @Valid @RequestBody AddDocumentObserversRequestDto requestDto) {
        return ResponseEntity.ok(documentService.addObservers(currentAccountService.getCurrentAccountId(), documentId, requestDto));
    }

    @PatchMapping("/{documentId}/hide")
    @Operation(summary = "Hide document", description = "Hides the document from the current account document list without changing workflow access.")
    @ApiResponse(responseCode = "204", description = "Document was hidden.")
    public ResponseEntity<Void> hideDocument(@PathVariable UUID documentId) {
        documentService.hideDocument(currentAccountService.getCurrentAccountId(), documentId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{documentId}/restore")
    @Operation(summary = "Restore hidden document", description = "Restores the document in the current account document list.")
    @ApiResponse(responseCode = "204", description = "Document was restored.")
    public ResponseEntity<Void> restoreDocument(@PathVariable UUID documentId) {
        documentService.restoreDocument(currentAccountService.getCurrentAccountId(), documentId);
        return ResponseEntity.noContent().build();
    }
}

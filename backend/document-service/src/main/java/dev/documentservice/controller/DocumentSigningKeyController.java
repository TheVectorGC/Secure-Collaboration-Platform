package dev.documentservice.controller;

import dev.documentservice.model.dto.request.RegisterDocumentSigningKeyRequestDto;
import dev.documentservice.model.dto.response.DocumentSigningKeyResponseDto;
import dev.documentservice.service.CurrentAccountService;
import dev.documentservice.service.DocumentSigningKeyService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/document-signing/devices/{deviceId}/keys")
@SecurityRequirement(name = "bearerAuth")
public class DocumentSigningKeyController {
    private final DocumentSigningKeyService documentSigningKeyService;
    private final CurrentAccountService currentAccountService;

    @PostMapping
    public ResponseEntity<DocumentSigningKeyResponseDto> registerSigningKey(
        @PathVariable UUID deviceId,
        @Valid @RequestBody RegisterDocumentSigningKeyRequestDto requestDto
    ) {
        return new ResponseEntity<>(
                documentSigningKeyService.registerSigningKey(currentAccountService.getCurrentAccountId(), deviceId, requestDto),
                HttpStatus.CREATED
        );
    }
}

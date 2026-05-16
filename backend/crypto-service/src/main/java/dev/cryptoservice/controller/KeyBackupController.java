package dev.cryptoservice.controller;

import dev.cryptoservice.model.dto.request.UpsertKeyBackupRequestDto;
import dev.cryptoservice.model.dto.response.KeyBackupResponseDto;
import dev.cryptoservice.model.dto.response.KeyBackupStatusResponseDto;
import dev.cryptoservice.service.CurrentAccountService;
import dev.cryptoservice.service.KeyBackupService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/crypto/key-backup")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Encrypted Key Backup", description = "APIs for encrypted account crypto backup storage")
public class KeyBackupController {
    private final KeyBackupService keyBackupService;
    private final CurrentAccountService currentAccountService;

    @Operation(summary = "Get encrypted key backup status")
    @GetMapping("/status")
    public ResponseEntity<KeyBackupStatusResponseDto> getStatus() {
        return ResponseEntity.ok(keyBackupService.getStatus(currentAccountService.getCurrentAccountId()));
    }

    @Operation(summary = "Download encrypted key backup")
    @GetMapping
    public ResponseEntity<KeyBackupResponseDto> getBackup() {
        return ResponseEntity.ok(keyBackupService.getBackup(currentAccountService.getCurrentAccountId()));
    }

    @Operation(summary = "Upload encrypted key backup")
    @PutMapping
    public ResponseEntity<KeyBackupResponseDto> upsertBackup(@Valid @RequestBody UpsertKeyBackupRequestDto requestDto) {
        return ResponseEntity.ok(keyBackupService.upsertBackup(currentAccountService.getCurrentAccountId(), requestDto));
    }
}

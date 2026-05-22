package dev.cryptoservice.controller;

import dev.cryptoservice.model.dto.request.UpsertAccountBackupProfileRequestDto;
import dev.cryptoservice.model.dto.response.AccountBackupProfileResponseDto;
import dev.cryptoservice.model.dto.response.AccountBackupPublicKeyResponseDto;
import dev.cryptoservice.service.AccountBackupProfileService;
import dev.cryptoservice.service.CurrentAccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/crypto/account-backup-profiles")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Account Backup Profiles", description = "APIs for account-level history recovery public keys")
public class AccountBackupProfileController {
    private final AccountBackupProfileService accountBackupProfileService;
    private final CurrentAccountService currentAccountService;

    @Operation(summary = "Get current account backup profile")
    @GetMapping("/me")
    public ResponseEntity<AccountBackupProfileResponseDto> getCurrentProfile() {
        return ResponseEntity.ok(accountBackupProfileService.getCurrentProfile(currentAccountService.getCurrentAccountId()));
    }

    @Operation(summary = "Create or update current account backup profile")
    @PutMapping("/me")
    public ResponseEntity<AccountBackupProfileResponseDto> upsertCurrentProfile(@Valid @RequestBody UpsertAccountBackupProfileRequestDto requestDto) {
        return ResponseEntity.ok(accountBackupProfileService.upsertCurrentProfile(currentAccountService.getCurrentAccountId(), requestDto));
    }

    @Operation(summary = "Get account backup public key")
    @GetMapping("/accounts/{accountId}/public-key")
    public ResponseEntity<AccountBackupPublicKeyResponseDto> getPublicKey(@PathVariable UUID accountId) {
        return ResponseEntity.ok(accountBackupProfileService.getPublicKey(accountId));
    }
}

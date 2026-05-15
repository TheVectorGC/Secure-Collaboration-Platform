package dev.cryptoservice.controller;

import dev.cryptoservice.model.dto.request.RegisterIdentityKeyRequestDto;
import dev.cryptoservice.model.dto.request.UploadOneTimePreKeysRequestDto;
import dev.cryptoservice.model.dto.request.UploadSignedPreKeyRequestDto;
import dev.cryptoservice.model.dto.response.IdentityKeyResponseDto;
import dev.cryptoservice.model.dto.response.PreKeyStatusResponseDto;
import dev.cryptoservice.service.CryptoKeyService;
import dev.cryptoservice.service.CurrentAccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/crypto/devices/{deviceId}")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Device Crypto Keys", description = "APIs for device public key material lifecycle")
public class DeviceKeyController {
    private final CryptoKeyService cryptoKeyService;
    private final CurrentAccountService currentAccountService;

    @Operation(summary = "Register device identity key")
    @PostMapping("/identity-key")
    public ResponseEntity<IdentityKeyResponseDto> registerIdentityKey(
        @PathVariable UUID deviceId,
        @Valid @RequestBody RegisterIdentityKeyRequestDto registerIdentityKeyRequestDto
    ) {
        IdentityKeyResponseDto identityKeyResponseDto = cryptoKeyService.registerIdentityKey(
            currentAccountService.getCurrentAccountId(),
            deviceId,
            registerIdentityKeyRequestDto
        );

        return new ResponseEntity<>(identityKeyResponseDto, HttpStatus.CREATED);
    }

    @Operation(summary = "Upload active signed prekey")
    @PutMapping("/signed-prekey")
    public ResponseEntity<Void> uploadSignedPreKey(
        @PathVariable UUID deviceId,
        @Valid @RequestBody UploadSignedPreKeyRequestDto uploadSignedPreKeyRequestDto
    ) {
        cryptoKeyService.uploadSignedPreKey(
            currentAccountService.getCurrentAccountId(),
            deviceId,
            uploadSignedPreKeyRequestDto
        );

        return new ResponseEntity<>(HttpStatus.OK);
    }

    @Operation(summary = "Upload one-time prekeys")
    @PostMapping("/one-time-prekeys")
    public ResponseEntity<Void> uploadOneTimePreKeys(
        @PathVariable UUID deviceId,
        @Valid @RequestBody UploadOneTimePreKeysRequestDto uploadOneTimePreKeysRequestDto
    ) {
        cryptoKeyService.uploadOneTimePreKeys(
            currentAccountService.getCurrentAccountId(),
            deviceId,
            uploadOneTimePreKeysRequestDto
        );

        return new ResponseEntity<>(HttpStatus.CREATED);
    }

    @Operation(summary = "Get device prekey status")
    @GetMapping("/prekey-status")
    public ResponseEntity<PreKeyStatusResponseDto> getPreKeyStatus(@PathVariable UUID deviceId) {
        return ResponseEntity.ok(
            cryptoKeyService.getPreKeyStatus(currentAccountService.getCurrentAccountId(), deviceId)
        );
    }
}

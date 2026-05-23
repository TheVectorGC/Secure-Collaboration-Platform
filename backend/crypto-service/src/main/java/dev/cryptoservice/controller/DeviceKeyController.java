package dev.cryptoservice.controller;

import dev.cryptoservice.model.dto.request.RegisterIdentityKeyRequestDto;
import dev.cryptoservice.model.dto.request.UploadKyberPreKeyRequestDto;
import dev.cryptoservice.model.dto.request.UploadOneTimePreKeysRequestDto;
import dev.cryptoservice.model.dto.request.UploadSignedPreKeyRequestDto;
import dev.cryptoservice.model.dto.response.IdentityKeyResponseDto;
import dev.cryptoservice.model.dto.response.PreKeyStatusResponseDto;
import dev.cryptoservice.service.CryptoKeyService;
import dev.cryptoservice.service.CurrentAccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/crypto/devices/{deviceId}")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Device Crypto Keys", description = "Lifecycle APIs for device identity keys, signed prekeys, Kyber prekeys, and one-time prekeys.")
public class DeviceKeyController {
    private final CryptoKeyService cryptoKeyService;
    private final CurrentAccountService currentAccountService;

    @Operation(
        summary = "Register device identity key",
        description = "Registers the long-term public identity key for a device owned by the authenticated account. The key is immutable for the device after registration."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Identity key registered."),
        @ApiResponse(responseCode = "400", description = "Request body or public key is invalid."),
        @ApiResponse(responseCode = "403", description = "The device does not belong to the authenticated account."),
        @ApiResponse(responseCode = "409", description = "The identity key is already registered.")
    })
    @PostMapping("/identity-key")
    public ResponseEntity<IdentityKeyResponseDto> registerIdentityKey(
        @PathVariable UUID deviceId,
        @Valid @RequestBody RegisterIdentityKeyRequestDto requestDto
    ) {
        IdentityKeyResponseDto responseDto = cryptoKeyService.registerIdentityKey(
            currentAccountService.getCurrentAccountId(),
            deviceId,
            requestDto
        );

        return new ResponseEntity<>(responseDto, HttpStatus.CREATED);
    }

    @Operation(
        summary = "Upload signed prekey",
        description = "Replaces the active signed prekey for a device. The signature must be verifiable with the device identity key."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Signed prekey uploaded."),
        @ApiResponse(responseCode = "400", description = "Public key or signature is invalid."),
        @ApiResponse(responseCode = "403", description = "The device does not belong to the authenticated account."),
        @ApiResponse(responseCode = "404", description = "The device identity key was not found."),
        @ApiResponse(responseCode = "409", description = "The signed prekey key ID already exists for this device.")
    })
    @PutMapping("/signed-prekey")
    public ResponseEntity<Void> uploadSignedPreKey(
        @PathVariable UUID deviceId,
        @Valid @RequestBody UploadSignedPreKeyRequestDto requestDto
    ) {
        cryptoKeyService.uploadSignedPreKey(currentAccountService.getCurrentAccountId(), deviceId, requestDto);
        return ResponseEntity.ok().build();
    }

    @Operation(
        summary = "Upload Kyber prekey",
        description = "Replaces the active post-quantum Kyber prekey for a device. The signature must be verifiable with the device identity key."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Kyber prekey uploaded."),
        @ApiResponse(responseCode = "400", description = "Public key or signature is invalid."),
        @ApiResponse(responseCode = "403", description = "The device does not belong to the authenticated account."),
        @ApiResponse(responseCode = "404", description = "The device identity key was not found."),
        @ApiResponse(responseCode = "409", description = "The Kyber prekey key ID already exists for this device.")
    })
    @PutMapping("/kyber-prekey")
    public ResponseEntity<Void> uploadKyberPreKey(
        @PathVariable UUID deviceId,
        @Valid @RequestBody UploadKyberPreKeyRequestDto requestDto
    ) {
        cryptoKeyService.uploadKyberPreKey(currentAccountService.getCurrentAccountId(), deviceId, requestDto);
        return ResponseEntity.ok().build();
    }

    @Operation(
        summary = "Upload one-time prekeys",
        description = "Adds a batch of one-time prekeys for asynchronous session establishment. Existing key IDs are rejected."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "One-time prekeys uploaded."),
        @ApiResponse(responseCode = "400", description = "Request body or one-time prekey value is invalid."),
        @ApiResponse(responseCode = "403", description = "The device does not belong to the authenticated account."),
        @ApiResponse(responseCode = "409", description = "At least one one-time prekey key ID already exists.")
    })
    @PostMapping("/one-time-prekeys")
    public ResponseEntity<Void> uploadOneTimePreKeys(
        @PathVariable UUID deviceId,
        @Valid @RequestBody UploadOneTimePreKeysRequestDto requestDto
    ) {
        cryptoKeyService.uploadOneTimePreKeys(currentAccountService.getCurrentAccountId(), deviceId, requestDto);
        return new ResponseEntity<>(HttpStatus.CREATED);
    }

    @Operation(
        summary = "Get device prekey status",
        description = "Returns the device key registration status and one-time prekey stock level for the authenticated device owner."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Prekey status returned."),
        @ApiResponse(responseCode = "403", description = "The device does not belong to the authenticated account.")
    })
    @GetMapping("/prekey-status")
    public ResponseEntity<PreKeyStatusResponseDto> getPreKeyStatus(@PathVariable UUID deviceId) {
        return ResponseEntity.ok(cryptoKeyService.getPreKeyStatus(currentAccountService.getCurrentAccountId(), deviceId));
    }
}

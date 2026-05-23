package dev.cryptoservice.controller;

import dev.cryptoservice.model.dto.response.PreKeyBundleResponseDto;
import dev.cryptoservice.service.CryptoKeyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/crypto/devices")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "PreKey Bundles", description = "APIs for fetching cryptographic prekey bundles of target devices.")
public class PreKeyBundleController {
    private final CryptoKeyService cryptoKeyService;

    @Operation(
        summary = "Get target device prekey bundle",
        description = "Returns the public prekey bundle needed by another device to start an encrypted session with the target device. One available one-time prekey is consumed atomically when present."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Prekey bundle returned."),
        @ApiResponse(responseCode = "403", description = "Target device is not active."),
        @ApiResponse(responseCode = "404", description = "Required target device key material is missing.")
    })
    @GetMapping("/{deviceId}/prekey-bundle")
    public ResponseEntity<PreKeyBundleResponseDto> getPreKeyBundle(@PathVariable UUID deviceId) {
        return ResponseEntity.ok(cryptoKeyService.getPreKeyBundle(deviceId));
    }
}

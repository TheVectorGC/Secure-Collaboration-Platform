package dev.identityservice.controller;

import dev.identityservice.model.dto.request.UpdateDeviceMetadataRequestDto;
import dev.identityservice.model.dto.response.ActiveDeviceResponseDto;
import dev.identityservice.model.dto.response.DeviceResponseDto;
import dev.identityservice.model.dto.response.InternalDeviceResponseDto;
import dev.identityservice.service.DeviceService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/devices")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Device Management", description = "APIs for managing account devices.")
public class DeviceController {
    private final DeviceService deviceService;

    @GetMapping
    public ResponseEntity<List<DeviceResponseDto>> getCurrentAccountDevices(Principal principal) {
        return ResponseEntity.ok(deviceService.getCurrentAccountDevices(principal.getName()));
    }

    @PutMapping("/{deviceId}/metadata")
    public ResponseEntity<DeviceResponseDto> updateCurrentAccountDeviceMetadata(
            Principal principal,
            @PathVariable UUID deviceId,
            @Valid @RequestBody UpdateDeviceMetadataRequestDto requestDto
    ) {
        return ResponseEntity.ok(deviceService.updateCurrentAccountDeviceMetadata(principal.getName(), deviceId, requestDto));
    }

    @DeleteMapping("/{deviceId}")
    public ResponseEntity<Void> revokeCurrentAccountDevice(
            Principal principal,
            @PathVariable UUID deviceId
    ) {
        deviceService.revokeCurrentAccountDevice(principal.getName(), deviceId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @GetMapping("/accounts/{accountId}/active")
    public ResponseEntity<List<ActiveDeviceResponseDto>> getActiveAccountDevices(@PathVariable UUID accountId) {
        return ResponseEntity.ok(deviceService.getActiveAccountDevices(accountId));
    }

    @GetMapping("/{deviceId}/internal")
    public ResponseEntity<InternalDeviceResponseDto> getInternalDevice(@PathVariable UUID deviceId) {
        return ResponseEntity.ok(deviceService.getInternalDevice(deviceId));
    }
}

package dev.cryptoservice.service.impl;

import dev.cryptoservice.client.IdentityDeviceClient;
import dev.cryptoservice.exception.DeviceAccessDeniedException;
import dev.cryptoservice.exception.DeviceNotActiveException;
import dev.cryptoservice.model.dto.response.InternalDeviceResponseDto;
import dev.cryptoservice.model.enumeration.DeviceStatus;
import dev.cryptoservice.service.DeviceAccessValidator;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeviceAccessValidatorImpl implements DeviceAccessValidator {
    private final IdentityDeviceClient identityDeviceClient;

    @Override
    public void validateDeviceOwner(UUID accountId, UUID deviceId) {
        InternalDeviceResponseDto internalDeviceResponseDto = identityDeviceClient.getDevice(deviceId);

        if (!accountId.equals(internalDeviceResponseDto.accountId())) {
            throw new DeviceAccessDeniedException("Device does not belong to current account.");
        }

        validateDeviceStatus(internalDeviceResponseDto);
    }

    @Override
    public void validateDeviceActive(UUID deviceId) {
        InternalDeviceResponseDto internalDeviceResponseDto = identityDeviceClient.getDevice(deviceId);
        validateDeviceStatus(internalDeviceResponseDto);
    }

    private void validateDeviceStatus(InternalDeviceResponseDto internalDeviceResponseDto) {
        if (internalDeviceResponseDto.status() != DeviceStatus.ACTIVE) {
            throw new DeviceNotActiveException("Device is not active.");
        }
    }
}

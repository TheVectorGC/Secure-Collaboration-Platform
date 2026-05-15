package dev.cryptoservice.client;

import dev.cryptoservice.model.dto.response.InternalDeviceResponseDto;
import java.util.UUID;

public interface IdentityDeviceClient {
    InternalDeviceResponseDto getDevice(UUID deviceId);
}

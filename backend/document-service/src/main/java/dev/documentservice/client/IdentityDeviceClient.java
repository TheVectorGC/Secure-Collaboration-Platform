package dev.documentservice.client;

import dev.documentservice.model.dto.response.InternalDeviceResponseDto;
import java.util.UUID;

public interface IdentityDeviceClient {
    InternalDeviceResponseDto getDevice(UUID deviceId);
}

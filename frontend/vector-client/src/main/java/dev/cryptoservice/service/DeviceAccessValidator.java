package dev.cryptoservice.service;

import java.util.UUID;

public interface DeviceAccessValidator {
    void validateDeviceOwner(UUID accountId, UUID deviceId);

    void validateDeviceActive(UUID deviceId);
}

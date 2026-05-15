package dev.identityservice.service;

import dev.identityservice.model.dto.request.LoginRequestDto;
import dev.identityservice.model.dto.response.ActiveDeviceResponseDto;
import dev.identityservice.model.dto.response.DeviceResponseDto;
import dev.identityservice.model.dto.response.InternalDeviceResponseDto;
import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.model.entity.DeviceEntity;
import java.util.List;
import java.util.UUID;

public interface DeviceService {
    DeviceEntity resolveLoginDevice(AccountEntity accountEntity, LoginRequestDto loginRequestDto);

    List<DeviceResponseDto> getCurrentAccountDevices(String username);

    List<ActiveDeviceResponseDto> getActiveAccountDevices(UUID accountId);

    InternalDeviceResponseDto getInternalDevice(UUID deviceId);

    void revokeCurrentAccountDevice(String username, UUID deviceId);

    void revokeDeviceSessions(UUID deviceId);
}

package dev.documentservice.model.dto.response;

import dev.documentservice.model.enumeration.DeviceStatus;
import java.util.UUID;

public record InternalDeviceResponseDto(
    UUID deviceId,
    UUID accountId,
    DeviceStatus status
) {}

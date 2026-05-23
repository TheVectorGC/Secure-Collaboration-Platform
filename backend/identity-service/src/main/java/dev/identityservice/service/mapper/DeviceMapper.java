package dev.identityservice.service.mapper;

import dev.identityservice.model.dto.response.ActiveDeviceResponseDto;
import dev.identityservice.model.dto.response.DeviceResponseDto;
import dev.identityservice.model.dto.response.InternalDeviceResponseDto;
import dev.identityservice.model.entity.DeviceEntity;
import org.springframework.stereotype.Component;

@Component
public class DeviceMapper {
    public DeviceResponseDto toDeviceResponseDto(DeviceEntity deviceEntity) {
        return new DeviceResponseDto(
                deviceEntity.getId(),
                deviceEntity.getDeviceName(),
                deviceEntity.getPlatform(),
                deviceEntity.getStatus(),
                deviceEntity.getClientVersion(),
                deviceEntity.getOsName(),
                deviceEntity.getOsVersion(),
                deviceEntity.getArchitecture(),
                deviceEntity.getHostname(),
                deviceEntity.getDeviceFingerprint(),
                deviceEntity.getLastSeenAt(),
                deviceEntity.getCreatedAt()
        );
    }

    public ActiveDeviceResponseDto toActiveDeviceResponseDto(DeviceEntity deviceEntity) {
        return new ActiveDeviceResponseDto(
                deviceEntity.getId(),
                deviceEntity.getAccountId(),
                deviceEntity.getDeviceName(),
                deviceEntity.getPlatform(),
                deviceEntity.getClientVersion(),
                deviceEntity.getOsName(),
                deviceEntity.getOsVersion(),
                deviceEntity.getArchitecture(),
                deviceEntity.getHostname(),
                deviceEntity.getDeviceFingerprint(),
                deviceEntity.getLastSeenAt()
        );
    }

    public InternalDeviceResponseDto toInternalDeviceResponseDto(DeviceEntity deviceEntity) {
        return new InternalDeviceResponseDto(
                deviceEntity.getId(),
                deviceEntity.getAccountId(),
                deviceEntity.getStatus()
        );
    }
}

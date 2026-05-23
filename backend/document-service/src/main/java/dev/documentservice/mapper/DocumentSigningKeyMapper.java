package dev.documentservice.mapper;

import dev.documentservice.model.dto.response.DocumentSigningKeyResponseDto;
import dev.documentservice.model.entity.DeviceDocumentSigningKeyEntity;
import org.springframework.stereotype.Component;

@Component
public class DocumentSigningKeyMapper {
    public DocumentSigningKeyResponseDto toResponseDto(DeviceDocumentSigningKeyEntity keyEntity) {
        return new DocumentSigningKeyResponseDto(
            keyEntity.getId(),
            keyEntity.getAccountId(),
            keyEntity.getDeviceId(),
            keyEntity.getAlgorithm(),
            keyEntity.getPublicKeyBase64(),
            keyEntity.getFingerprint(),
            keyEntity.getStatus(),
            keyEntity.getCreatedAt()
        );
    }
}

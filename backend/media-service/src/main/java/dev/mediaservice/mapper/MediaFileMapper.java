package dev.mediaservice.mapper;

import dev.mediaservice.model.dto.response.MediaFileResponseDto;
import dev.mediaservice.model.entity.MediaFileEntity;
import org.springframework.stereotype.Component;

@Component
public class MediaFileMapper {
    public MediaFileResponseDto toResponseDto(MediaFileEntity mediaFileEntity) {
        return new MediaFileResponseDto(
            mediaFileEntity.getId(),
            mediaFileEntity.getChatId(),
            mediaFileEntity.getUploaderAccountId(),
            mediaFileEntity.getEncryptedSizeBytes(),
            mediaFileEntity.getEncryptedSha256Base64(),
            mediaFileEntity.getCreatedAt()
        );
    }
}

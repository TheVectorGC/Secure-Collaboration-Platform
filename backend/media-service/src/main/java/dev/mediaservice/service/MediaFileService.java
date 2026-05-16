package dev.mediaservice.service;

import dev.mediaservice.model.dto.request.UploadEncryptedMediaRequestDto;
import dev.mediaservice.model.dto.response.MediaFileResponseDto;
import dev.mediaservice.model.dto.response.StoredMediaResourceDto;
import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;

public interface MediaFileService {
    MediaFileResponseDto uploadEncryptedFile(MultipartFile encryptedFile, UploadEncryptedMediaRequestDto requestDto);

    MediaFileResponseDto getMetadata(UUID mediaFileId);

    StoredMediaResourceDto getEncryptedFile(UUID mediaFileId);

    void deleteOwnFile(UUID mediaFileId);
}

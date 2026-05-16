package dev.mediaservice.service;

import dev.mediaservice.model.dto.response.StoredMediaResourceDto;
import java.io.InputStream;
import java.util.UUID;

public interface MediaStorageService {
    StoredMediaResourceDto store(UUID mediaFileId, InputStream inputStream, long declaredSizeBytes, String expectedSha256Base64);

    StoredMediaResourceDto load(UUID mediaFileId, String storageObjectKey, long encryptedSizeBytes, String encryptedSha256Base64);

    void delete(String storageObjectKey);
}

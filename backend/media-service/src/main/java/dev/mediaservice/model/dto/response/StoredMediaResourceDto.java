package dev.mediaservice.model.dto.response;

import java.nio.file.Path;
import java.util.UUID;

public record StoredMediaResourceDto(
    UUID mediaFileId,
    String storageObjectKey,
    Path path,
    long encryptedSizeBytes,
    String encryptedSha256Base64
) {}

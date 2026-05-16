package dev.mediaservice.service.impl;

import dev.mediaservice.config.properties.MediaStorageProperties;
import dev.mediaservice.exception.MediaStorageException;
import dev.mediaservice.model.dto.response.StoredMediaResourceDto;
import dev.mediaservice.service.MediaStorageService;
import java.security.DigestInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class FileSystemMediaStorageService implements MediaStorageService {
    private static final int BUFFER_SIZE = 8192;

    private final MediaStorageProperties mediaStorageProperties;

    @Override
    public StoredMediaResourceDto store(
        UUID mediaFileId,
        InputStream inputStream,
        long declaredSizeBytes,
        String expectedSha256Base64
    ) {
        try {
            validateDeclaredSize(declaredSizeBytes);

            Path rootPath = Path.of(mediaStorageProperties.rootPath()).toAbsolutePath().normalize();
            String storageObjectKey = createStorageObjectKey(mediaFileId);
            Path targetPath = rootPath.resolve(storageObjectKey).normalize();

            if (!targetPath.startsWith(rootPath)) {
                throw new MediaStorageException("Resolved media storage path is invalid.");
            }

            Files.createDirectories(targetPath.getParent());
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            long writtenBytes = 0;

            try (DigestInputStream digestInputStream = new DigestInputStream(inputStream, messageDigest);
                 java.io.OutputStream outputStream = Files.newOutputStream(targetPath)) {
                byte[] buffer = new byte[BUFFER_SIZE];
                int readBytes;

                while ((readBytes = digestInputStream.read(buffer)) != -1) {
                    writtenBytes += readBytes;

                    if (writtenBytes > mediaStorageProperties.maxFileSizeBytes()) {
                        throw new MediaStorageException("Encrypted file exceeds maximum allowed size.");
                    }

                    outputStream.write(buffer, 0, readBytes);
                }
            }

            if (declaredSizeBytes >= 0 && declaredSizeBytes != writtenBytes) {
                Files.deleteIfExists(targetPath);
                throw new MediaStorageException("Encrypted file size does not match declared size.");
            }

            String actualSha256Base64 = Base64.getEncoder().encodeToString(messageDigest.digest());

            if (StringUtils.hasText(expectedSha256Base64) && !expectedSha256Base64.equals(actualSha256Base64)) {
                Files.deleteIfExists(targetPath);
                throw new MediaStorageException("Encrypted file SHA-256 hash does not match declared hash.");
            }

            return new StoredMediaResourceDto(mediaFileId, storageObjectKey, targetPath, writtenBytes, actualSha256Base64);
        }
        catch (MediaStorageException exception) {
            throw exception;
        }
        catch (Exception exception) {
            throw new MediaStorageException("Failed to store encrypted media file.", exception);
        }
    }

    @Override
    public StoredMediaResourceDto load(
        UUID mediaFileId,
        String storageObjectKey,
        long encryptedSizeBytes,
        String encryptedSha256Base64
    ) {
        Path rootPath = Path.of(mediaStorageProperties.rootPath()).toAbsolutePath().normalize();
        Path mediaPath = rootPath.resolve(storageObjectKey).normalize();

        if (!mediaPath.startsWith(rootPath)) {
            throw new MediaStorageException("Resolved media storage path is invalid.");
        }

        if (!Files.exists(mediaPath)) {
            throw new MediaStorageException("Encrypted media file is missing from storage.");
        }

        return new StoredMediaResourceDto(mediaFileId, storageObjectKey, mediaPath, encryptedSizeBytes, encryptedSha256Base64);
    }

    @Override
    public void delete(String storageObjectKey) {
        try {
            Path rootPath = Path.of(mediaStorageProperties.rootPath()).toAbsolutePath().normalize();
            Path mediaPath = rootPath.resolve(storageObjectKey).normalize();

            if (!mediaPath.startsWith(rootPath)) {
                throw new MediaStorageException("Resolved media storage path is invalid.");
            }

            Files.deleteIfExists(mediaPath);
        }
        catch (MediaStorageException exception) {
            throw exception;
        }
        catch (Exception exception) {
            throw new MediaStorageException("Failed to delete encrypted media file.", exception);
        }
    }

    private void validateDeclaredSize(long declaredSizeBytes) {
        if (declaredSizeBytes > mediaStorageProperties.maxFileSizeBytes()) {
            throw new MediaStorageException("Encrypted file exceeds maximum allowed size.");
        }
    }

    private String createStorageObjectKey(UUID mediaFileId) {
        OffsetDateTime now = OffsetDateTime.now();
        String mediaFileIdValue = mediaFileId.toString().replace("-", "");
        String shard = mediaFileIdValue.substring(0, 2);
        String hashPrefix = HexFormat.of().formatHex(mediaFileIdValue.substring(0, 8).getBytes());

        return String.format(
                "%04d/%02d/%02d/%s/%s-%s.bin",
                now.getYear(),
                now.getMonthValue(),
                now.getDayOfMonth(),
                shard,
                hashPrefix,
                mediaFileId
        );
    }
}

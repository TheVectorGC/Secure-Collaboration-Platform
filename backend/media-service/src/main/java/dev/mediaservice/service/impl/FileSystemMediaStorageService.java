package dev.mediaservice.service.impl;

import dev.mediaservice.properties.MediaStorageProperties;
import dev.mediaservice.exception.MediaFileValidationException;
import dev.mediaservice.exception.MediaStorageException;
import dev.mediaservice.model.dto.response.StoredMediaResourceDto;
import dev.mediaservice.service.MediaStorageService;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileSystemMediaStorageService implements MediaStorageService {
    private static final int BUFFER_SIZE = 8192;
    private static final String TEMPORARY_FILE_SUFFIX = ".tmp";

    private final MediaStorageProperties mediaStorageProperties;

    @Override
    public StoredMediaResourceDto store(
        UUID mediaFileId,
        InputStream inputStream,
        long declaredSizeBytes,
        String expectedSha256Base64
    ) {
        validateDeclaredSize(declaredSizeBytes);
        Path rootPath = getRootPath();
        String storageObjectKey = createStorageObjectKey(mediaFileId);
        Path targetPath = resolveStoragePath(rootPath, storageObjectKey);
        Path temporaryPath = targetPath.resolveSibling(targetPath.getFileName() + TEMPORARY_FILE_SUFFIX);

        try {
            Files.createDirectories(targetPath.getParent());
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            long writtenBytes = writeEncryptedBytes(inputStream, temporaryPath, messageDigest);
            validateActualSize(declaredSizeBytes, writtenBytes);
            String actualSha256Base64 = Base64.getEncoder().encodeToString(messageDigest.digest());
            validateSha256(expectedSha256Base64, actualSha256Base64);
            moveTemporaryFile(temporaryPath, targetPath);
            log.debug("Encrypted media bytes were stored. mediaFileId={} storageObjectKey={} encryptedSizeBytes={}", mediaFileId, storageObjectKey, writtenBytes);
            return new StoredMediaResourceDto(mediaFileId, storageObjectKey, targetPath, writtenBytes, actualSha256Base64);
        }
        catch (MediaFileValidationException | MediaStorageException exception) {
            deleteTemporaryFile(temporaryPath);
            throw exception;
        }
        catch (Exception exception) {
            deleteTemporaryFile(temporaryPath);
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
        Path mediaPath = resolveStoragePath(getRootPath(), storageObjectKey);
        if (!Files.exists(mediaPath)) {
            throw new MediaStorageException("Encrypted media file is missing from storage.");
        }
        return new StoredMediaResourceDto(mediaFileId, storageObjectKey, mediaPath, encryptedSizeBytes, encryptedSha256Base64);
    }

    @Override
    public void delete(String storageObjectKey) {
        try {
            Path mediaPath = resolveStoragePath(getRootPath(), storageObjectKey);
            Files.deleteIfExists(mediaPath);
        }
        catch (MediaStorageException exception) {
            throw exception;
        }
        catch (Exception exception) {
            throw new MediaStorageException("Failed to delete encrypted media file.", exception);
        }
    }

    private long writeEncryptedBytes(InputStream inputStream, Path temporaryPath, MessageDigest messageDigest) throws Exception {
        long writtenBytes = 0;
        try (DigestInputStream digestInputStream = new DigestInputStream(inputStream, messageDigest);
             OutputStream outputStream = Files.newOutputStream(temporaryPath)) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int readBytes;
            while ((readBytes = digestInputStream.read(buffer)) != -1) {
                writtenBytes += readBytes;
                if (writtenBytes > mediaStorageProperties.maxFileSizeBytes()) {
                    throw new MediaFileValidationException("Encrypted file exceeds maximum allowed size.");
                }
                outputStream.write(buffer, 0, readBytes);
            }
        }
        return writtenBytes;
    }

    private void validateDeclaredSize(long declaredSizeBytes) {
        if (declaredSizeBytes > mediaStorageProperties.maxFileSizeBytes()) {
            throw new MediaFileValidationException("Encrypted file exceeds maximum allowed size.");
        }
    }

    private void validateActualSize(long declaredSizeBytes, long writtenBytes) {
        if (declaredSizeBytes >= 0 && declaredSizeBytes != writtenBytes) {
            throw new MediaFileValidationException("Encrypted file size does not match declared size.");
        }
    }

    private void validateSha256(String expectedSha256Base64, String actualSha256Base64) {
        if (StringUtils.hasText(expectedSha256Base64) && !expectedSha256Base64.equals(actualSha256Base64)) {
            throw new MediaFileValidationException("Encrypted file SHA-256 hash does not match declared hash.");
        }
    }

    private Path getRootPath() {
        return Path.of(mediaStorageProperties.rootPath()).toAbsolutePath().normalize();
    }

    private Path resolveStoragePath(Path rootPath, String storageObjectKey) {
        Path storagePath = rootPath.resolve(storageObjectKey).normalize();
        if (!storagePath.startsWith(rootPath)) {
            throw new MediaStorageException("Resolved media storage path is invalid.");
        }
        return storagePath;
    }

    private String createStorageObjectKey(UUID mediaFileId) {
        OffsetDateTime now = OffsetDateTime.now();
        String mediaFileIdValue = mediaFileId.toString().replace("-", "");
        String shard = mediaFileIdValue.substring(0, 2);
        return String.format(
            "%04d/%02d/%02d/%s/%s.bin",
            now.getYear(),
            now.getMonthValue(),
            now.getDayOfMonth(),
            shard,
            mediaFileId
        );
    }

    private void moveTemporaryFile(Path temporaryPath, Path targetPath) throws Exception {
        try {
            Files.move(temporaryPath, targetPath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        }
        catch (AtomicMoveNotSupportedException exception) {
            Files.move(temporaryPath, targetPath, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private void deleteTemporaryFile(Path temporaryPath) {
        try {
            Files.deleteIfExists(temporaryPath);
        }
        catch (Exception exception) {
            log.warn("Failed to delete temporary encrypted media file. path={}", temporaryPath, exception);
        }
    }
}

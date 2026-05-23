package dev.mediaservice.service.impl;

import dev.mediaservice.client.MessagingAccessClient;
import dev.mediaservice.exception.MediaAccessDeniedException;
import dev.mediaservice.exception.MediaFileNotFoundException;
import dev.mediaservice.exception.MediaFileValidationException;
import dev.mediaservice.exception.MediaStorageException;
import dev.mediaservice.mapper.MediaFileMapper;
import dev.mediaservice.model.dto.request.GrantMediaAccessRequestDto;
import dev.mediaservice.model.dto.request.UploadEncryptedMediaRequestDto;
import dev.mediaservice.model.dto.response.InternalChatResponseDto;
import dev.mediaservice.model.dto.response.MediaFileResponseDto;
import dev.mediaservice.model.dto.response.StoredMediaResourceDto;
import dev.mediaservice.model.entity.MediaFileAccessEntity;
import dev.mediaservice.model.entity.MediaFileEntity;
import dev.mediaservice.model.enumeration.MediaFileStatus;
import dev.mediaservice.repository.MediaFileAccessRepository;
import dev.mediaservice.repository.MediaFileRepository;
import dev.mediaservice.service.CurrentAccountService;
import dev.mediaservice.service.MediaFileService;
import dev.mediaservice.service.MediaStorageService;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaFileServiceImpl implements MediaFileService {
    private final MediaFileRepository mediaFileRepository;
    private final MediaFileAccessRepository mediaFileAccessRepository;
    private final MediaStorageService mediaStorageService;
    private final CurrentAccountService currentAccountService;
    private final MessagingAccessClient messagingAccessClient;
    private final MediaChatAccessPolicy mediaChatAccessPolicy;
    private final MediaFileMapper mediaFileMapper;

    @Override
    @Transactional
    public MediaFileResponseDto uploadEncryptedFile(MultipartFile encryptedFile, UploadEncryptedMediaRequestDto requestDto) {
        validateUploadRequest(encryptedFile, requestDto);

        UUID mediaFileId = UUID.randomUUID();
        UUID currentAccountId = currentAccountService.getCurrentAccountId();
        UUID chatId = requestDto.chatId();
        if (chatId != null) {
            validateActiveMediaChatAccess(chatId, currentAccountId);
        }

        StoredMediaResourceDto storedMediaResourceDto = null;
        try {
            storedMediaResourceDto = mediaStorageService.store(
                mediaFileId,
                encryptedFile.getInputStream(),
                encryptedFile.getSize(),
                requestDto.encryptedSha256Base64());
            MediaFileEntity mediaFileEntity = createMediaFileEntity(mediaFileId, currentAccountId, chatId, storedMediaResourceDto);
            MediaFileEntity savedMediaFileEntity = mediaFileRepository.save(mediaFileEntity);
            grantAccessInternal(savedMediaFileEntity.getId(), currentAccountId, toAccountIdSet(requestDto.accessAccountIds()));
            log.info("Encrypted media file was uploaded. mediaFileId={} chatId={} uploaderAccountId={} encryptedSizeBytes={}", savedMediaFileEntity.getId(), chatId, currentAccountId, savedMediaFileEntity.getEncryptedSizeBytes());
            return mediaFileMapper.toResponseDto(savedMediaFileEntity);
        }
        catch (RuntimeException exception) {
            deleteStoredResourceAfterFailedUpload(storedMediaResourceDto);
            throw exception;
        }
        catch (Exception exception) {
            deleteStoredResourceAfterFailedUpload(null);
            throw new MediaStorageException("Failed to upload encrypted media file.", exception);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public MediaFileResponseDto getMetadata(UUID mediaFileId) {
        MediaFileEntity mediaFileEntity = getActiveMediaFile(mediaFileId);
        validateMediaAccess(mediaFileEntity);
        return mediaFileMapper.toResponseDto(mediaFileEntity);
    }

    @Override
    @Transactional(readOnly = true)
    public StoredMediaResourceDto getEncryptedFile(UUID mediaFileId) {
        MediaFileEntity mediaFileEntity = getActiveMediaFile(mediaFileId);
        validateMediaAccess(mediaFileEntity);
        return mediaStorageService.load(
            mediaFileEntity.getId(),
            mediaFileEntity.getStorageObjectKey(),
            mediaFileEntity.getEncryptedSizeBytes(),
            mediaFileEntity.getEncryptedSha256Base64());
    }

    @Override
    @Transactional
    public void grantAccess(UUID mediaFileId, GrantMediaAccessRequestDto requestDto) {
        MediaFileEntity mediaFileEntity = getActiveMediaFile(mediaFileId);
        UUID currentAccountId = currentAccountService.getCurrentAccountId();
        if (!mediaFileEntity.getUploaderAccountId().equals(currentAccountId)) {
            throw new MediaAccessDeniedException("Only uploader can grant media file access.");
        }
        int insertedAccessRecords = grantAccessInternal(mediaFileId, currentAccountId, toAccountIdSet(requestDto.accountIds()));
        log.info("Encrypted media access was granted. mediaFileId={} ownerAccountId={} insertedAccessRecords={}", mediaFileId, currentAccountId, insertedAccessRecords);
    }

    @Override
    @Transactional
    public void deleteOwnFile(UUID mediaFileId) {
        MediaFileEntity mediaFileEntity = getActiveMediaFile(mediaFileId);
        UUID currentAccountId = currentAccountService.getCurrentAccountId();
        if (!mediaFileEntity.getUploaderAccountId().equals(currentAccountId)) {
            throw new MediaAccessDeniedException("Only uploader can delete encrypted media file.");
        }
        mediaFileEntity.setStatus(MediaFileStatus.DELETED);
        mediaFileEntity.setDeletedAt(OffsetDateTime.now());
        mediaFileRepository.save(mediaFileEntity);
        mediaStorageService.delete(mediaFileEntity.getStorageObjectKey());
        log.info("Encrypted media file was deleted. mediaFileId={} uploaderAccountId={}", mediaFileId, currentAccountId);
    }

    private void validateUploadRequest(MultipartFile encryptedFile, UploadEncryptedMediaRequestDto requestDto) {
        if (encryptedFile == null || encryptedFile.isEmpty()) {
            throw new MediaFileValidationException("Encrypted file must not be empty.");
        }
        if (requestDto == null) {
            throw new MediaFileValidationException("Media metadata is required.");
        }
    }

    private MediaFileEntity createMediaFileEntity(
        UUID mediaFileId,
        UUID uploaderAccountId,
        UUID chatId,
        StoredMediaResourceDto storedMediaResourceDto
    ) {
        return MediaFileEntity.builder()
            .id(mediaFileId)
            .uploaderAccountId(uploaderAccountId)
            .chatId(chatId)
            .storageObjectKey(storedMediaResourceDto.storageObjectKey())
            .encryptedSizeBytes(storedMediaResourceDto.encryptedSizeBytes())
            .encryptedSha256Base64(storedMediaResourceDto.encryptedSha256Base64())
            .status(MediaFileStatus.ACTIVE)
            .createdAt(OffsetDateTime.now())
            .build();
    }

    private int grantAccessInternal(UUID mediaFileId, UUID ownerAccountId, Set<UUID> accountIds) {
        accountIds.add(ownerAccountId);
        OffsetDateTime now = OffsetDateTime.now();
        Set<UUID> distinctAccountIds = new HashSet<>(accountIds);
        int insertedAccessRecords = 0;
        for (UUID accountId : distinctAccountIds) {
            if (accountId == null || mediaFileAccessRepository.existsByMediaFileIdAndAccountId(mediaFileId, accountId)) {
                continue;
            }
            MediaFileAccessEntity mediaFileAccessEntity = MediaFileAccessEntity.builder()
                .id(UUID.randomUUID())
                .mediaFileId(mediaFileId)
                .accountId(accountId)
                .createdAt(now)
                .build();
            mediaFileAccessRepository.save(mediaFileAccessEntity);
            insertedAccessRecords++;
        }
        return insertedAccessRecords;
    }

    private void validateActiveMediaChatAccess(UUID chatId, UUID currentAccountId) {
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(chatId);
        mediaChatAccessPolicy.validateUploadAccess(chatResponseDto, currentAccountId);
    }

    private MediaFileEntity getActiveMediaFile(UUID mediaFileId) {
        return mediaFileRepository.findByIdAndStatus(mediaFileId, MediaFileStatus.ACTIVE)
            .orElseThrow(() -> new MediaFileNotFoundException(mediaFileId));
    }

    private void validateMediaAccess(MediaFileEntity mediaFileEntity) {
        UUID currentAccountId = currentAccountService.getCurrentAccountId();
        if (mediaFileEntity.getUploaderAccountId().equals(currentAccountId)) {
            return;
        }
        if (mediaFileAccessRepository.existsByMediaFileIdAndAccountId(mediaFileEntity.getId(), currentAccountId)) {
            return;
        }
        if (mediaFileEntity.getChatId() == null) {
            throw new MediaAccessDeniedException("Current account cannot access this media file.");
        }
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(mediaFileEntity.getChatId());
        mediaChatAccessPolicy.validateVisibleAccess(chatResponseDto, currentAccountId, mediaFileEntity.getCreatedAt());
    }

    private Set<UUID> toAccountIdSet(Iterable<UUID> accountIds) {
        Set<UUID> accountIdSet = new HashSet<>();
        if (accountIds == null) {
            return accountIdSet;
        }
        for (UUID accountId : accountIds) {
            accountIdSet.add(accountId);
        }
        return accountIdSet;
    }

    private void deleteStoredResourceAfterFailedUpload(StoredMediaResourceDto storedMediaResourceDto) {
        if (storedMediaResourceDto != null) {
            mediaStorageService.delete(storedMediaResourceDto.storageObjectKey());
        }
    }
}

package dev.mediaservice.service.impl;

import dev.mediaservice.client.MessagingAccessClient;
import dev.mediaservice.exception.MediaAccessDeniedException;
import dev.mediaservice.exception.MediaFileNotFoundException;
import dev.mediaservice.exception.MediaStorageException;
import dev.mediaservice.model.dto.request.UploadEncryptedMediaRequestDto;
import dev.mediaservice.model.dto.response.InternalChatParticipantResponseDto;
import dev.mediaservice.model.dto.response.InternalChatResponseDto;
import dev.mediaservice.model.dto.response.MediaFileResponseDto;
import dev.mediaservice.model.dto.response.StoredMediaResourceDto;
import dev.mediaservice.model.entity.MediaFileEntity;
import dev.mediaservice.model.enumeration.MediaFileStatus;
import dev.mediaservice.repository.MediaFileRepository;
import dev.mediaservice.service.CurrentAccountService;
import dev.mediaservice.service.MediaFileService;
import dev.mediaservice.service.MediaStorageService;
import java.time.OffsetDateTime;
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
    private final MediaStorageService mediaStorageService;
    private final CurrentAccountService currentAccountService;
    private final MessagingAccessClient messagingAccessClient;

    @Override
    @Transactional
    public MediaFileResponseDto uploadEncryptedFile(MultipartFile encryptedFile, UploadEncryptedMediaRequestDto requestDto) {
        if (encryptedFile == null || encryptedFile.isEmpty()) {
            throw new MediaStorageException("Encrypted file must not be empty.");
        }

        if (requestDto == null || requestDto.chatId() == null) {
            throw new MediaStorageException("Media chat ID is required.");
        }

        UUID mediaFileId = UUID.randomUUID();
        UUID currentAccountId = currentAccountService.getCurrentAccountId();
        UUID chatId = requestDto.chatId();
        String expectedSha256Base64 = requestDto.encryptedSha256Base64();
        messagingAccessClient.validateCurrentAccountCanAccessChat(chatId);
        StoredMediaResourceDto storedMediaResourceDto = null;

        try {
            storedMediaResourceDto = mediaStorageService.store(
                    mediaFileId,
                    encryptedFile.getInputStream(),
                    encryptedFile.getSize(),
                    expectedSha256Base64
            );

            MediaFileEntity mediaFileEntity = MediaFileEntity.builder()
                    .id(mediaFileId)
                    .uploaderAccountId(currentAccountId)
                    .chatId(chatId)
                    .storageObjectKey(storedMediaResourceDto.storageObjectKey())
                    .encryptedSizeBytes(storedMediaResourceDto.encryptedSizeBytes())
                    .encryptedSha256Base64(storedMediaResourceDto.encryptedSha256Base64())
                    .status(MediaFileStatus.ACTIVE)
                    .createdAt(OffsetDateTime.now())
                    .build();

            MediaFileEntity savedMediaFileEntity = mediaFileRepository.save(mediaFileEntity);
            log.info(
                    "Encrypted media file uploaded. Media file ID: {}, uploader account ID: {}, encrypted size: {}.",
                    savedMediaFileEntity.getId(),
                    savedMediaFileEntity.getUploaderAccountId(),
                    savedMediaFileEntity.getEncryptedSizeBytes()
            );

            return toResponseDto(savedMediaFileEntity);
        }
        catch (RuntimeException exception) {
            if (storedMediaResourceDto != null) {
                mediaStorageService.delete(storedMediaResourceDto.storageObjectKey());
            }

            throw exception;
        }
        catch (Exception exception) {
            if (storedMediaResourceDto != null) {
                mediaStorageService.delete(storedMediaResourceDto.storageObjectKey());
            }

            throw new MediaStorageException("Failed to upload encrypted media file.", exception);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public MediaFileResponseDto getMetadata(UUID mediaFileId) {
        MediaFileEntity mediaFileEntity = getActiveMediaFile(mediaFileId);
        validateMediaChatAccess(mediaFileEntity);
        return toResponseDto(mediaFileEntity);
    }

    @Override
    @Transactional(readOnly = true)
    public StoredMediaResourceDto getEncryptedFile(UUID mediaFileId) {
        MediaFileEntity mediaFileEntity = getActiveMediaFile(mediaFileId);
        validateMediaChatAccess(mediaFileEntity);

        return mediaStorageService.load(
                mediaFileEntity.getId(),
                mediaFileEntity.getStorageObjectKey(),
                mediaFileEntity.getEncryptedSizeBytes(),
                mediaFileEntity.getEncryptedSha256Base64()
        );
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
        log.info("Encrypted media file deleted. Media file ID: {}.", mediaFileId);
    }

    private MediaFileEntity getActiveMediaFile(UUID mediaFileId) {
        return mediaFileRepository.findByIdAndStatus(mediaFileId, MediaFileStatus.ACTIVE)
                .orElseThrow(() -> new MediaFileNotFoundException(mediaFileId));
    }


    private void validateMediaChatAccess(MediaFileEntity mediaFileEntity) {
        if (mediaFileEntity.getChatId() == null) {
            throw new MediaAccessDeniedException("Media file is not linked to a chat.");
        }

        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(mediaFileEntity.getChatId());
        validateMediaVisibilityForCurrentAccount(chatResponseDto, mediaFileEntity.getCreatedAt());
    }

    private void validateMediaVisibilityForCurrentAccount(InternalChatResponseDto chatResponseDto, OffsetDateTime mediaCreatedAt) {
        UUID currentAccountId = currentAccountService.getCurrentAccountId();
        InternalChatParticipantResponseDto currentParticipant = findCurrentParticipant(chatResponseDto, currentAccountId);

        if (currentParticipant == null || !"ACTIVE".equals(currentParticipant.status())) {
            throw new MediaAccessDeniedException("Current account does not have access to this media file.");
        }

        if (currentParticipant.historyVisibleFromCreatedAt() != null && mediaCreatedAt.isBefore(currentParticipant.historyVisibleFromCreatedAt())) {
            throw new MediaAccessDeniedException("Current account does not have access to this media file history.");
        }

        if (currentParticipant.removedAt() != null && mediaCreatedAt.isAfter(currentParticipant.removedAt())) {
            throw new MediaAccessDeniedException("Current account does not have access to this media file.");
        }
    }

    private InternalChatParticipantResponseDto findCurrentParticipant(InternalChatResponseDto chatResponseDto, UUID currentAccountId) {
        if (chatResponseDto == null || chatResponseDto.participants() == null) {
            return null;
        }

        return chatResponseDto.participants()
                .stream()
                .filter(participant -> currentAccountId.equals(participant.accountId()))
                .findFirst()
                .orElse(null);
    }

    private MediaFileResponseDto toResponseDto(MediaFileEntity mediaFileEntity) {
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

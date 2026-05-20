package dev.mediaservice.service.impl;

import dev.mediaservice.client.MessagingAccessClient;
import dev.mediaservice.exception.MediaAccessDeniedException;
import dev.mediaservice.exception.MediaFileNotFoundException;
import dev.mediaservice.exception.MediaStorageException;
import dev.mediaservice.model.dto.request.UploadEncryptedMediaRequestDto;
import dev.mediaservice.model.dto.response.InternalChatParticipantResponseDto;
import dev.mediaservice.model.dto.response.InternalChatParticipantVisibilityWindowResponseDto;
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
        validateActiveMediaChatAccess(chatId, currentAccountId);
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

    private void validateActiveMediaChatAccess(UUID chatId, UUID currentAccountId) {
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(chatId);

        boolean activeParticipantExists = chatResponseDto.participants() != null
                && chatResponseDto.participants().stream()
                .anyMatch(participant -> currentAccountId.equals(participant.accountId()) && "ACTIVE".equals(participant.status()));

        if (!activeParticipantExists) {
            throw new MediaAccessDeniedException("Only active chat participants can upload media files.");
        }
    }

    private MediaFileEntity getActiveMediaFile(UUID mediaFileId) {
        return mediaFileRepository.findByIdAndStatus(mediaFileId, MediaFileStatus.ACTIVE)
                .orElseThrow(() -> new MediaFileNotFoundException(mediaFileId));
    }


    private void validateMediaChatAccess(MediaFileEntity mediaFileEntity) {
        if (mediaFileEntity.getChatId() == null) {
            throw new MediaAccessDeniedException("Media file is not linked to a chat.");
        }

        validateVisibleMediaChatAccess(mediaFileEntity.getChatId(), mediaFileEntity.getCreatedAt());
    }

    private void validateVisibleMediaChatAccess(UUID chatId, OffsetDateTime mediaCreatedAt) {
        UUID currentAccountId = currentAccountService.getCurrentAccountId();
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(chatId);
        InternalChatParticipantResponseDto currentParticipant = findCurrentParticipant(chatResponseDto, currentAccountId);

        if (!isVisibleAt(currentParticipant, mediaCreatedAt)) {
            throw new MediaAccessDeniedException("Current account cannot access this media file because it is outside visible group history.");
        }
    }

    private InternalChatParticipantResponseDto findCurrentParticipant(InternalChatResponseDto chatResponseDto, UUID currentAccountId) {
        return chatResponseDto.participants() == null
                ? null
                : chatResponseDto.participants().stream()
                .filter(participant -> currentAccountId.equals(participant.accountId()))
                .findFirst()
                .orElse(null);
    }

    private boolean isVisibleAt(InternalChatParticipantResponseDto participant, OffsetDateTime createdAt) {
        if (participant == null) {
            return false;
        }

        if (participant.visibilityWindows() != null && !participant.visibilityWindows().isEmpty()) {
            return participant.visibilityWindows().stream()
                    .anyMatch(visibilityWindow -> isInsideWindow(createdAt, visibilityWindow));
        }

        if (participant.historyVisibleFromCreatedAt() != null && createdAt.isBefore(participant.historyVisibleFromCreatedAt())) {
            return false;
        }

        if (participant.removedAt() != null && createdAt.isAfter(participant.removedAt())) {
            return false;
        }

        return true;
    }

    private boolean isInsideWindow(OffsetDateTime createdAt, InternalChatParticipantVisibilityWindowResponseDto visibilityWindow) {
        if (visibilityWindow.visibleFromCreatedAt() != null && createdAt.isBefore(visibilityWindow.visibleFromCreatedAt())) {
            return false;
        }

        if (visibilityWindow.visibleUntilCreatedAt() != null && createdAt.isAfter(visibilityWindow.visibleUntilCreatedAt())) {
            return false;
        }

        return true;
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

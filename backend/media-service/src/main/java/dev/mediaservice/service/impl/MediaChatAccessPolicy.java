package dev.mediaservice.service.impl;

import dev.mediaservice.exception.MediaAccessDeniedException;
import dev.mediaservice.model.dto.response.InternalChatParticipantResponseDto;
import dev.mediaservice.model.dto.response.InternalChatParticipantVisibilityWindowResponseDto;
import dev.mediaservice.model.dto.response.InternalChatResponseDto;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class MediaChatAccessPolicy {
    private static final String ACTIVE_PARTICIPANT_STATUS = "ACTIVE";

    public void validateUploadAccess(InternalChatResponseDto chatResponseDto, UUID accountId) {
        boolean activeParticipantExists = chatResponseDto.participants() != null
            && chatResponseDto.participants().stream().anyMatch(participant -> isActiveParticipant(participant, accountId));
        if (!activeParticipantExists) {
            throw new MediaAccessDeniedException("Only active chat participants can upload media files.");
        }
    }

    public void validateVisibleAccess(InternalChatResponseDto chatResponseDto, UUID accountId, OffsetDateTime mediaCreatedAt) {
        InternalChatParticipantResponseDto participant = findParticipant(chatResponseDto, accountId);
        if (participant == null || !isVisibleAt(participant, mediaCreatedAt)) {
            throw new MediaAccessDeniedException("Current account cannot access this media file because it is outside visible group history.");
        }
    }

    private boolean isActiveParticipant(InternalChatParticipantResponseDto participant, UUID accountId) {
        return accountId.equals(participant.accountId()) && ACTIVE_PARTICIPANT_STATUS.equals(participant.status());
    }

    private InternalChatParticipantResponseDto findParticipant(InternalChatResponseDto chatResponseDto, UUID accountId) {
        if (chatResponseDto.participants() == null) {
            return null;
        }
        return chatResponseDto.participants()
            .stream()
            .filter(participant -> accountId.equals(participant.accountId()))
            .findFirst()
            .orElse(null);
    }

    private boolean isVisibleAt(InternalChatParticipantResponseDto participant, OffsetDateTime createdAt) {
        if (participant.visibilityWindows() != null && !participant.visibilityWindows().isEmpty()) {
            return participant.visibilityWindows().stream().anyMatch(visibilityWindow -> isInsideWindow(createdAt, visibilityWindow));
        }
        if (participant.historyVisibleFromCreatedAt() != null && createdAt.isBefore(participant.historyVisibleFromCreatedAt())) {
            return false;
        }
        return participant.removedAt() == null || !createdAt.isAfter(participant.removedAt());
    }

    private boolean isInsideWindow(OffsetDateTime createdAt, InternalChatParticipantVisibilityWindowResponseDto visibilityWindow) {
        if (visibilityWindow.visibleFromCreatedAt() != null && createdAt.isBefore(visibilityWindow.visibleFromCreatedAt())) {
            return false;
        }
        return visibilityWindow.visibleUntilCreatedAt() == null || !createdAt.isAfter(visibilityWindow.visibleUntilCreatedAt());
    }
}

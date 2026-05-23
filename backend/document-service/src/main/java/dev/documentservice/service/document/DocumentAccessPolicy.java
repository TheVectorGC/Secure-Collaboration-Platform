package dev.documentservice.service.document;

import dev.documentservice.model.dto.response.InternalChatParticipantResponseDto;
import dev.documentservice.model.dto.response.InternalChatParticipantVisibilityWindowResponseDto;
import dev.documentservice.model.dto.response.InternalChatResponseDto;
import dev.documentservice.model.entity.DocumentEntity;
import dev.documentservice.repository.DocumentObserverRepository;
import dev.documentservice.repository.DocumentSignerRepository;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DocumentAccessPolicy {
    private final DocumentSignerRepository documentSignerRepository;
    private final DocumentObserverRepository documentObserverRepository;

    public boolean hasDirectWorkflowAccess(DocumentEntity documentEntity, UUID accountId) {
        if (documentEntity.getOwnerAccountId().equals(accountId)) {
            return true;
        }
        if (documentSignerRepository.findByDocumentIdAndSignerAccountId(documentEntity.getId(), accountId).isPresent()) {
            return true;
        }
        return documentObserverRepository.findByDocumentIdAndObserverAccountId(documentEntity.getId(), accountId).isPresent();
    }

    public boolean isDocumentVisibleToAccount(DocumentEntity documentEntity, InternalChatResponseDto chatResponseDto, UUID accountId) {
        if (hasDirectWorkflowAccess(documentEntity, accountId)) {
            return true;
        }
        InternalChatParticipantResponseDto participant = findParticipant(chatResponseDto, accountId);
        if (participant == null) {
            return false;
        }
        return isVisibleAt(participant, documentEntity.getCreatedAt());
    }

    private InternalChatParticipantResponseDto findParticipant(InternalChatResponseDto chatResponseDto, UUID accountId) {
        if (chatResponseDto.participants() == null) {
            return null;
        }
        return chatResponseDto.participants().stream().filter(participant -> accountId.equals(participant.accountId())).findFirst().orElse(null);
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

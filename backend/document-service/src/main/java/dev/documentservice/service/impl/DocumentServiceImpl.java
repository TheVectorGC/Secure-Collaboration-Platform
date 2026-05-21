package dev.documentservice.service.impl;

import dev.documentservice.client.MessagingAccessClient;
import dev.documentservice.exception.DocumentAccessDeniedException;
import dev.documentservice.exception.DocumentAlreadySignedException;
import dev.documentservice.exception.DocumentNotFoundException;
import dev.documentservice.exception.DocumentRejectedException;
import dev.documentservice.exception.DocumentValidationException;
import dev.documentservice.exception.SigningKeyNotFoundException;
import dev.documentservice.model.dto.request.CreateDocumentRequestDto;
import dev.documentservice.model.dto.request.RejectDocumentRequestDto;
import dev.documentservice.model.dto.request.SignDocumentRequestDto;
import dev.documentservice.model.dto.response.DocumentResponseDto;
import dev.documentservice.model.dto.response.DocumentSignatureResponseDto;
import dev.documentservice.model.dto.response.DocumentSignerResponseDto;
import dev.documentservice.model.dto.response.InternalChatParticipantResponseDto;
import dev.documentservice.model.dto.response.InternalChatParticipantVisibilityWindowResponseDto;
import dev.documentservice.model.dto.response.InternalChatResponseDto;
import dev.documentservice.model.entity.DeviceDocumentSigningKeyEntity;
import dev.documentservice.model.entity.DocumentEntity;
import dev.documentservice.model.entity.DocumentSignatureEntity;
import dev.documentservice.model.entity.DocumentSignerEntity;
import dev.documentservice.model.enumeration.DocumentSignerStatus;
import dev.documentservice.model.enumeration.DocumentSigningKeyStatus;
import dev.documentservice.model.enumeration.DocumentStatus;
import dev.documentservice.model.enumeration.SignatureAlgorithm;
import dev.documentservice.repository.DeviceDocumentSigningKeyRepository;
import dev.documentservice.repository.DocumentRepository;
import dev.documentservice.repository.DocumentSignatureRepository;
import dev.documentservice.repository.DocumentSignerRepository;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentServiceImpl implements dev.documentservice.service.DocumentService {
    private final DocumentRepository documentRepository;
    private final DocumentSignatureRepository documentSignatureRepository;
    private final DocumentSignerRepository documentSignerRepository;
    private final DeviceDocumentSigningKeyRepository deviceDocumentSigningKeyRepository;
    private final MessagingAccessClient messagingAccessClient;

    @Override
    @Transactional
    public DocumentResponseDto createDocument(UUID currentAccountId, CreateDocumentRequestDto requestDto) {
        InternalChatResponseDto chatResponseDto = validateActiveDocumentChatAccess(requestDto.chatId(), currentAccountId);
        List<UUID> requiredSignerAccountIds = normalizeRequiredSignerAccountIds(requestDto.requiredSignerAccountIds());
        validateRequiredSigners(chatResponseDto, requiredSignerAccountIds);

        OffsetDateTime now = OffsetDateTime.now();
        DocumentEntity documentEntity = DocumentEntity.builder()
                .id(UUID.randomUUID())
                .chatId(requestDto.chatId())
                .mediaFileId(requestDto.mediaFileId())
                .ownerAccountId(currentAccountId)
                .title(requestDto.title().trim())
                .description(normalizeOptionalText(requestDto.description()))
                .fileName(requestDto.fileName())
                .mimeType(requestDto.mimeType())
                .sizeBytes(requestDto.sizeBytes())
                .plaintextSha256Base64(requestDto.plaintextSha256Base64())
                .encryptedSha256Base64(requestDto.encryptedSha256Base64())
                .status(DocumentStatus.PENDING_SIGNATURES)
                .createdAt(now)
                .updatedAt(now)
                .build();
        DocumentEntity savedDocumentEntity = documentRepository.save(documentEntity);
        List<DocumentSignerEntity> signerEntities = requiredSignerAccountIds.stream()
                .map(signerAccountId -> DocumentSignerEntity.builder()
                        .id(UUID.randomUUID())
                        .documentId(savedDocumentEntity.getId())
                        .signerAccountId(signerAccountId)
                        .status(DocumentSignerStatus.PENDING)
                        .createdAt(now)
                        .build())
                .toList();
        documentSignerRepository.saveAll(signerEntities);
        log.info("Document created. Document ID: {}, chat ID: {}.", savedDocumentEntity.getId(), savedDocumentEntity.getChatId());
        return toResponseDto(savedDocumentEntity, signerEntities, List.of());
    }

    @Override
    @Transactional(readOnly = true)
    public DocumentResponseDto getDocument(UUID currentAccountId, UUID documentId) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(documentEntity.getChatId());
        if (!isDocumentVisibleToAccount(documentEntity, chatResponseDto, currentAccountId)) {
            throw new DocumentAccessDeniedException("Current account cannot access this document because it is outside visible chat history.");
        }
        return toResponseDto(documentEntity, documentSignerRepository.findByDocumentId(documentId), documentSignatureRepository.findByDocumentId(documentId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponseDto> getCurrentAccountDocuments(UUID currentAccountId) {
        List<InternalChatResponseDto> currentChats = messagingAccessClient.getCurrentAccountChats();
        List<UUID> accessibleChatIds = currentChats.stream()
                .map(InternalChatResponseDto::chatId)
                .toList();
        if (accessibleChatIds.isEmpty()) {
            return List.of();
        }
        Map<UUID, InternalChatResponseDto> chatsById = currentChats.stream()
                .collect(Collectors.toMap(InternalChatResponseDto::chatId, Function.identity(), (left, right) -> left));
        List<DocumentEntity> documents = documentRepository.findByChatIdInOrderByCreatedAtDesc(accessibleChatIds)
                .stream()
                .filter(documentEntity -> isDocumentVisibleToAccount(documentEntity, chatsById.get(documentEntity.getChatId()), currentAccountId))
                .toList();
        Map<UUID, List<DocumentSignatureEntity>> signaturesByDocumentId = loadSignaturesByDocumentId(documents.stream().map(DocumentEntity::getId).toList());
        Map<UUID, List<DocumentSignerEntity>> signersByDocumentId = loadSignersByDocumentId(documents.stream().map(DocumentEntity::getId).toList());
        return documents.stream()
                .map(documentEntity -> toResponseDto(
                        documentEntity,
                        signersByDocumentId.getOrDefault(documentEntity.getId(), List.of()),
                        signaturesByDocumentId.getOrDefault(documentEntity.getId(), List.of())
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponseDto> getChatDocuments(UUID currentAccountId, UUID chatId) {
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(chatId);
        List<DocumentEntity> documents = documentRepository.findByChatIdOrderByCreatedAtDesc(chatId)
                .stream()
                .filter(documentEntity -> isDocumentVisibleToAccount(documentEntity, chatResponseDto, currentAccountId))
                .toList();
        Map<UUID, List<DocumentSignatureEntity>> signaturesByDocumentId = loadSignaturesByDocumentId(documents.stream().map(DocumentEntity::getId).toList());
        Map<UUID, List<DocumentSignerEntity>> signersByDocumentId = loadSignersByDocumentId(documents.stream().map(DocumentEntity::getId).toList());
        return documents.stream()
                .map(documentEntity -> toResponseDto(
                        documentEntity,
                        signersByDocumentId.getOrDefault(documentEntity.getId(), List.of()),
                        signaturesByDocumentId.getOrDefault(documentEntity.getId(), List.of())
                ))
                .toList();
    }

    @Override
    @Transactional
    public DocumentResponseDto signDocument(UUID currentAccountId, UUID documentId, SignDocumentRequestDto requestDto) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        validateActiveDocumentChatAccess(documentEntity.getChatId(), currentAccountId);
        validateDocumentCanBeCompleted(documentEntity);
        DocumentSignerEntity signerEntity = getPendingSigner(documentId, currentAccountId);
        if (!documentEntity.getPlaintextSha256Base64().equals(requestDto.documentHashBase64())) {
            throw new DocumentValidationException("Signed document hash does not match registered document hash.");
        }
        if (documentSignatureRepository.existsByDocumentIdAndSignerAccountId(documentId, currentAccountId)) {
            throw new DocumentAlreadySignedException("Current account already signed this document.");
        }
        DeviceDocumentSigningKeyEntity signingKeyEntity = deviceDocumentSigningKeyRepository
                .findByAccountIdAndDeviceIdAndFingerprintAndStatus(
                        currentAccountId,
                        requestDto.signerDeviceId(),
                        requestDto.signingKeyFingerprint(),
                        DocumentSigningKeyStatus.ACTIVE
                )
                .orElseThrow(() -> new SigningKeyNotFoundException("Document signing key was not found for this account device."));
        if (!verifySignature(signingKeyEntity.getPublicKeyBase64(), requestDto.documentHashBase64(), requestDto.signatureBase64())) {
            throw new DocumentValidationException("Document signature is invalid.");
        }

        OffsetDateTime now = OffsetDateTime.now();
        DocumentSignatureEntity signatureEntity = DocumentSignatureEntity.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .signerAccountId(currentAccountId)
                .signerDeviceId(requestDto.signerDeviceId())
                .signingKeyFingerprint(requestDto.signingKeyFingerprint())
                .algorithm(SignatureAlgorithm.ED25519)
                .documentHashBase64(requestDto.documentHashBase64())
                .signatureBase64(requestDto.signatureBase64())
                .signedAt(now)
                .build();
        documentSignatureRepository.save(signatureEntity);
        signerEntity.setStatus(DocumentSignerStatus.SIGNED);
        signerEntity.setSignedAt(now);
        documentSignerRepository.save(signerEntity);
        updateDocumentAggregateStatus(documentEntity, documentSignerRepository.findByDocumentId(documentId), now);
        log.info("Document signed. Document ID: {}, signer account ID: {}.", documentId, currentAccountId);
        return toResponseDto(documentEntity, documentSignerRepository.findByDocumentId(documentId), documentSignatureRepository.findByDocumentId(documentId));
    }

    @Override
    @Transactional
    public DocumentResponseDto rejectDocument(UUID currentAccountId, UUID documentId, RejectDocumentRequestDto requestDto) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        validateActiveDocumentChatAccess(documentEntity.getChatId(), currentAccountId);
        validateDocumentCanBeCompleted(documentEntity);
        DocumentSignerEntity signerEntity = getPendingSigner(documentId, currentAccountId);
        if (documentSignatureRepository.existsByDocumentIdAndSignerAccountId(documentId, currentAccountId)) {
            throw new DocumentValidationException("Signed document cannot be rejected by the same account.");
        }

        OffsetDateTime now = OffsetDateTime.now();
        String normalizedReason = normalizeOptionalText(requestDto.reason());
        signerEntity.setStatus(DocumentSignerStatus.REJECTED);
        signerEntity.setRejectedAt(now);
        signerEntity.setRejectionReason(normalizedReason);
        documentSignerRepository.save(signerEntity);
        documentEntity.setStatus(DocumentStatus.REJECTED);
        documentEntity.setRejectedByAccountId(currentAccountId);
        documentEntity.setRejectedAt(now);
        documentEntity.setRejectionReason(normalizedReason);
        documentEntity.setUpdatedAt(now);
        documentRepository.save(documentEntity);
        log.info("Document rejected. Document ID: {}, rejected by account ID: {}.", documentId, currentAccountId);
        return toResponseDto(documentEntity, documentSignerRepository.findByDocumentId(documentId), documentSignatureRepository.findByDocumentId(documentId));
    }

    @Override
    @Transactional
    public DocumentResponseDto cancelDocument(UUID currentAccountId, UUID documentId, RejectDocumentRequestDto requestDto) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        validateActiveDocumentChatAccess(documentEntity.getChatId(), currentAccountId);
        if (!currentAccountId.equals(documentEntity.getOwnerAccountId())) {
            throw new DocumentAccessDeniedException("Only document owner can cancel document workflow.");
        }
        if (documentEntity.getStatus() == DocumentStatus.FULLY_SIGNED) {
            throw new DocumentValidationException("Fully signed document cannot be cancelled.");
        }
        if (documentEntity.getStatus() == DocumentStatus.CANCELLED) {
            throw new DocumentValidationException("Document is already cancelled.");
        }

        OffsetDateTime now = OffsetDateTime.now();
        documentEntity.setStatus(DocumentStatus.CANCELLED);
        documentEntity.setCancelledByAccountId(currentAccountId);
        documentEntity.setCancelledAt(now);
        documentEntity.setCancellationReason(normalizeOptionalText(requestDto.reason()));
        documentEntity.setUpdatedAt(now);
        documentRepository.save(documentEntity);
        log.info("Document cancelled. Document ID: {}, cancelled by account ID: {}.", documentId, currentAccountId);
        return toResponseDto(documentEntity, documentSignerRepository.findByDocumentId(documentId), documentSignatureRepository.findByDocumentId(documentId));
    }

    private InternalChatResponseDto validateActiveDocumentChatAccess(UUID chatId, UUID currentAccountId) {
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(chatId);
        InternalChatParticipantResponseDto currentParticipant = findParticipant(chatResponseDto, currentAccountId);
        if (currentParticipant == null) {
            throw new DocumentAccessDeniedException("Current account is not a document chat participant.");
        }
        if ("GROUP".equals(chatResponseDto.type()) && !"ACTIVE".equals(currentParticipant.status())) {
            throw new DocumentAccessDeniedException("Removed group participant cannot create or update documents.");
        }
        return chatResponseDto;
    }

    private List<UUID> normalizeRequiredSignerAccountIds(List<UUID> requiredSignerAccountIds) {
        if (requiredSignerAccountIds == null) {
            return List.of();
        }
        List<UUID> normalizedSignerAccountIds = new ArrayList<>();
        Set<UUID> knownSignerAccountIds = new HashSet<>();
        for (UUID requiredSignerAccountId : requiredSignerAccountIds) {
            if (requiredSignerAccountId != null && knownSignerAccountIds.add(requiredSignerAccountId)) {
                normalizedSignerAccountIds.add(requiredSignerAccountId);
            }
        }
        if (normalizedSignerAccountIds.isEmpty()) {
            throw new DocumentValidationException("Document must have at least one required signer.");
        }
        return normalizedSignerAccountIds;
    }

    private void validateRequiredSigners(InternalChatResponseDto chatResponseDto, List<UUID> requiredSignerAccountIds) {
        Map<UUID, InternalChatParticipantResponseDto> participantsByAccountId = chatResponseDto.participants()
                .stream()
                .collect(Collectors.toMap(InternalChatParticipantResponseDto::accountId, Function.identity(), (left, right) -> left));
        for (UUID signerAccountId : requiredSignerAccountIds) {
            InternalChatParticipantResponseDto participant = participantsByAccountId.get(signerAccountId);
            if (participant == null) {
                throw new DocumentValidationException("Required signer is not a chat participant.");
            }
            if ("GROUP".equals(chatResponseDto.type()) && !"ACTIVE".equals(participant.status())) {
                throw new DocumentValidationException("Required signer must be an active group participant.");
            }
        }
    }

    private void validateDocumentCanBeCompleted(DocumentEntity documentEntity) {
        if (documentEntity.getStatus() == DocumentStatus.REJECTED) {
            throw new DocumentRejectedException("Rejected document cannot be completed.");
        }
        if (documentEntity.getStatus() == DocumentStatus.CANCELLED) {
            throw new DocumentValidationException("Cancelled document cannot be completed.");
        }
        if (documentEntity.getStatus() == DocumentStatus.FULLY_SIGNED) {
            throw new DocumentValidationException("Fully signed document cannot be completed again.");
        }
    }

    private DocumentSignerEntity getPendingSigner(UUID documentId, UUID currentAccountId) {
        DocumentSignerEntity signerEntity = documentSignerRepository.findByDocumentIdAndSignerAccountId(documentId, currentAccountId)
                .orElseThrow(() -> new DocumentAccessDeniedException("Current account is not a required document signer."));
        if (signerEntity.getStatus() == DocumentSignerStatus.SIGNED) {
            throw new DocumentAlreadySignedException("Current account already signed this document.");
        }
        if (signerEntity.getStatus() == DocumentSignerStatus.REJECTED) {
            throw new DocumentValidationException("Current account already rejected this document.");
        }
        return signerEntity;
    }

    private void updateDocumentAggregateStatus(DocumentEntity documentEntity, List<DocumentSignerEntity> signerEntities, OffsetDateTime updatedAt) {
        boolean hasRejectedSigner = signerEntities.stream().anyMatch(signerEntity -> signerEntity.getStatus() == DocumentSignerStatus.REJECTED);
        if (hasRejectedSigner) {
            documentEntity.setStatus(DocumentStatus.REJECTED);
        }
        else {
            long signedCount = signerEntities.stream().filter(signerEntity -> signerEntity.getStatus() == DocumentSignerStatus.SIGNED).count();
            if (signedCount == 0) {
                documentEntity.setStatus(DocumentStatus.PENDING_SIGNATURES);
            }
            else if (signedCount == signerEntities.size()) {
                documentEntity.setStatus(DocumentStatus.FULLY_SIGNED);
            }
            else {
                documentEntity.setStatus(DocumentStatus.PARTIALLY_SIGNED);
            }
        }
        documentEntity.setUpdatedAt(updatedAt);
        documentRepository.save(documentEntity);
    }

    private boolean isDocumentVisibleToAccount(DocumentEntity documentEntity, InternalChatResponseDto chatResponseDto, UUID currentAccountId) {
        if (chatResponseDto == null) {
            return false;
        }
        InternalChatParticipantResponseDto participant = findParticipant(chatResponseDto, currentAccountId);
        return isVisibleAt(participant, documentEntity.getCreatedAt());
    }

    private InternalChatParticipantResponseDto findParticipant(InternalChatResponseDto chatResponseDto, UUID currentAccountId) {
        if (chatResponseDto == null || chatResponseDto.participants() == null) {
            return null;
        }
        return chatResponseDto.participants().stream()
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

    private DocumentEntity getDocumentEntity(UUID documentId) {
        return documentRepository.findById(documentId)
                .orElseThrow(() -> new DocumentNotFoundException(documentId));
    }

    private Map<UUID, List<DocumentSignatureEntity>> loadSignaturesByDocumentId(Collection<UUID> documentIds) {
        if (documentIds.isEmpty()) {
            return Map.of();
        }
        return documentSignatureRepository.findByDocumentIdIn(documentIds)
                .stream()
                .collect(Collectors.groupingBy(DocumentSignatureEntity::getDocumentId));
    }

    private Map<UUID, List<DocumentSignerEntity>> loadSignersByDocumentId(Collection<UUID> documentIds) {
        if (documentIds.isEmpty()) {
            return Map.of();
        }
        return documentSignerRepository.findByDocumentIdIn(documentIds)
                .stream()
                .collect(Collectors.groupingBy(DocumentSignerEntity::getDocumentId));
    }

    private boolean verifySignature(String publicKeyBase64, String documentHashBase64, String signatureBase64) {
        try {
            byte[] publicKeyBytes = Base64.getDecoder().decode(publicKeyBase64);
            byte[] documentHashBytes = Base64.getDecoder().decode(documentHashBase64);
            byte[] signatureBytes = Base64.getDecoder().decode(signatureBase64);
            PublicKey publicKey = KeyFactory.getInstance("Ed25519").generatePublic(new X509EncodedKeySpec(publicKeyBytes));
            Signature signature = Signature.getInstance("Ed25519");
            signature.initVerify(publicKey);
            signature.update(documentHashBytes);
            return signature.verify(signatureBytes);
        }
        catch (Exception exception) {
            throw new DocumentValidationException("Failed to verify document signature.", exception);
        }
    }

    private DocumentResponseDto toResponseDto(DocumentEntity documentEntity, List<DocumentSignerEntity> signerEntities, List<DocumentSignatureEntity> signatureEntities) {
        List<DocumentSignerResponseDto> signers = signerEntities.stream()
                .sorted(Comparator.comparing(DocumentSignerEntity::getCreatedAt))
                .map(this::toSignerResponseDto)
                .toList();
        List<DocumentSignatureResponseDto> signatures = signatureEntities.stream()
                .sorted(Comparator.comparing(DocumentSignatureEntity::getSignedAt))
                .map(this::toSignatureResponseDto)
                .toList();
        return new DocumentResponseDto(
                documentEntity.getId(),
                documentEntity.getChatId(),
                documentEntity.getMediaFileId(),
                documentEntity.getOwnerAccountId(),
                normalizeDocumentTitle(documentEntity),
                documentEntity.getDescription(),
                documentEntity.getFileName(),
                documentEntity.getMimeType(),
                documentEntity.getSizeBytes(),
                documentEntity.getPlaintextSha256Base64(),
                documentEntity.getEncryptedSha256Base64(),
                documentEntity.getStatus(),
                documentEntity.getRejectedByAccountId(),
                documentEntity.getRejectedAt(),
                documentEntity.getRejectionReason(),
                documentEntity.getCancelledByAccountId(),
                documentEntity.getCancelledAt(),
                documentEntity.getCancellationReason(),
                documentEntity.getCreatedAt(),
                documentEntity.getUpdatedAt(),
                signers,
                signatures
        );
    }

    private DocumentSignerResponseDto toSignerResponseDto(DocumentSignerEntity signerEntity) {
        return new DocumentSignerResponseDto(
                signerEntity.getId(),
                signerEntity.getDocumentId(),
                signerEntity.getSignerAccountId(),
                signerEntity.getStatus(),
                signerEntity.getCreatedAt(),
                signerEntity.getSignedAt(),
                signerEntity.getRejectedAt(),
                signerEntity.getRejectionReason()
        );
    }

    private DocumentSignatureResponseDto toSignatureResponseDto(DocumentSignatureEntity signatureEntity) {
        return new DocumentSignatureResponseDto(
                signatureEntity.getId(),
                signatureEntity.getDocumentId(),
                signatureEntity.getSignerAccountId(),
                signatureEntity.getSignerDeviceId(),
                signatureEntity.getSigningKeyFingerprint(),
                signatureEntity.getAlgorithm(),
                signatureEntity.getDocumentHashBase64(),
                signatureEntity.getSignatureBase64(),
                signatureEntity.getSignedAt()
        );
    }

    private String normalizeDocumentTitle(DocumentEntity documentEntity) {
        if (StringUtils.hasText(documentEntity.getTitle())) {
            return documentEntity.getTitle();
        }
        return documentEntity.getFileName();
    }

    private String normalizeOptionalText(String text) {
        if (!StringUtils.hasText(text)) {
            return null;
        }
        return text.trim();
    }
}

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
import dev.documentservice.model.dto.response.DocumentObserverResponseDto;
import dev.documentservice.model.dto.response.DocumentResponseDto;
import dev.documentservice.model.dto.response.DocumentSignatureResponseDto;
import dev.documentservice.model.dto.response.DocumentSignerResponseDto;
import dev.documentservice.model.dto.response.InternalChatParticipantResponseDto;
import dev.documentservice.model.dto.response.InternalChatParticipantVisibilityWindowResponseDto;
import dev.documentservice.model.dto.response.InternalChatResponseDto;
import dev.documentservice.model.entity.DeviceDocumentSigningKeyEntity;
import dev.documentservice.model.entity.DocumentEntity;
import dev.documentservice.model.entity.DocumentHiddenEntity;
import dev.documentservice.model.entity.DocumentObserverEntity;
import dev.documentservice.model.entity.DocumentSignatureEntity;
import dev.documentservice.model.entity.DocumentSignerEntity;
import dev.documentservice.model.enumeration.DocumentObserverRole;
import dev.documentservice.model.enumeration.DocumentSignerStatus;
import dev.documentservice.model.enumeration.DocumentSigningKeyStatus;
import dev.documentservice.model.enumeration.DocumentStatus;
import dev.documentservice.model.enumeration.SignatureAlgorithm;
import dev.documentservice.repository.DeviceDocumentSigningKeyRepository;
import dev.documentservice.repository.DocumentHiddenRepository;
import dev.documentservice.repository.DocumentObserverRepository;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
    private final DocumentObserverRepository documentObserverRepository;
    private final DocumentHiddenRepository documentHiddenRepository;
    private final DeviceDocumentSigningKeyRepository deviceDocumentSigningKeyRepository;
    private final MessagingAccessClient messagingAccessClient;

    @Override
    @Transactional
    public DocumentResponseDto createDocument(UUID currentAccountId, CreateDocumentRequestDto requestDto) {
        validateActiveDocumentChatAccess(requestDto.chatId(), currentAccountId);
        List<UUID> requiredSignerAccountIds = normalizeRequiredSignerAccountIds(requestDto.requiredSignerAccountIds());
        List<UUID> observerAccountIds = normalizeObserverAccountIds(requestDto.observerAccountIds(), requiredSignerAccountIds, currentAccountId);
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
        List<DocumentObserverEntity> observerEntities = observerAccountIds.stream()
                .map(observerAccountId -> DocumentObserverEntity.builder()
                        .id(UUID.randomUUID())
                        .documentId(savedDocumentEntity.getId())
                        .observerAccountId(observerAccountId)
                        .role(DocumentObserverRole.OBSERVER)
                        .createdAt(now)
                        .build())
                .toList();
        documentSignerRepository.saveAll(signerEntities);
        documentObserverRepository.saveAll(observerEntities);
        log.info("Document created. Document ID: {}, chat ID: {}.", savedDocumentEntity.getId(), savedDocumentEntity.getChatId());
        return toResponseDto(savedDocumentEntity, signerEntities, observerEntities, List.of());
    }

    @Override
    @Transactional(readOnly = true)
    public DocumentResponseDto getDocument(UUID currentAccountId, UUID documentId) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        validateDocumentWorkflowAccess(documentEntity, currentAccountId);
        return toResponseDto(
                documentEntity,
                documentSignerRepository.findByDocumentId(documentId),
                documentObserverRepository.findByDocumentId(documentId),
                documentSignatureRepository.findByDocumentId(documentId)
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponseDto> getCurrentAccountDocuments(UUID currentAccountId) {
        List<DocumentEntity> ownedDocuments = documentRepository.findByOwnerAccountIdOrderByCreatedAtDesc(currentAccountId);
        List<UUID> signerDocumentIds = documentSignerRepository.findBySignerAccountIdOrderByCreatedAtDesc(currentAccountId)
                .stream()
                .map(DocumentSignerEntity::getDocumentId)
                .distinct()
                .toList();
        List<UUID> observerDocumentIds = documentObserverRepository.findByObserverAccountIdOrderByCreatedAtDesc(currentAccountId)
                .stream()
                .map(DocumentObserverEntity::getDocumentId)
                .distinct()
                .toList();
        List<DocumentEntity> signerDocuments = signerDocumentIds.isEmpty()
                ? List.of()
                : documentRepository.findByIdInOrderByCreatedAtDesc(signerDocumentIds);
        List<DocumentEntity> observerDocuments = observerDocumentIds.isEmpty()
                ? List.of()
                : documentRepository.findByIdInOrderByCreatedAtDesc(observerDocumentIds);
        List<DocumentEntity> documents = mergeDocuments(mergeDocuments(ownedDocuments, signerDocuments), observerDocuments);
        documents = filterHiddenDocuments(currentAccountId, documents);
        return toResponseDtos(documents);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponseDto> getChatDocuments(UUID currentAccountId, UUID chatId) {
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(chatId);
        List<DocumentEntity> documents = documentRepository.findByChatIdOrderByCreatedAtDesc(chatId)
                .stream()
                .filter(documentEntity -> isDocumentVisibleToAccount(documentEntity, chatResponseDto, currentAccountId))
                .toList();
        documents = filterHiddenDocuments(currentAccountId, documents);
        return toResponseDtos(documents);
    }

    @Override
    @Transactional
    public DocumentResponseDto signDocument(UUID currentAccountId, UUID documentId, SignDocumentRequestDto requestDto) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
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
                .orElseThrow(() -> new SigningKeyNotFoundException("Active document signing key was not found for current device."));
        verifySignature(signingKeyEntity, requestDto.documentHashBase64(), requestDto.signatureBase64());
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
        DocumentSignatureEntity savedSignatureEntity = documentSignatureRepository.save(signatureEntity);
        signerEntity.setStatus(DocumentSignerStatus.SIGNED);
        signerEntity.setSignedAt(now);
        signerEntity.setRejectedAt(null);
        signerEntity.setRejectionReason(null);
        documentSignerRepository.save(signerEntity);
        List<DocumentSignerEntity> signerEntities = documentSignerRepository.findByDocumentId(documentId);
        updateDocumentStatusAfterSignature(documentEntity, signerEntities, now);
        DocumentEntity savedDocumentEntity = documentRepository.save(documentEntity);
        List<DocumentSignatureEntity> signatureEntities = new ArrayList<>(documentSignatureRepository.findByDocumentId(documentId));
        if (signatureEntities.stream().noneMatch(existingSignature -> existingSignature.getId().equals(savedSignatureEntity.getId()))) {
            signatureEntities.add(savedSignatureEntity);
        }
        return toResponseDto(savedDocumentEntity, signerEntities, documentObserverRepository.findByDocumentId(documentId), signatureEntities);
    }

    @Override
    @Transactional
    public DocumentResponseDto rejectDocument(UUID currentAccountId, UUID documentId, RejectDocumentRequestDto requestDto) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        validateDocumentCanBeCompleted(documentEntity);
        DocumentSignerEntity signerEntity = getPendingSigner(documentId, currentAccountId);
        OffsetDateTime now = OffsetDateTime.now();
        String rejectionReason = normalizeOptionalText(requestDto.reason());
        signerEntity.setStatus(DocumentSignerStatus.REJECTED);
        signerEntity.setRejectedAt(now);
        signerEntity.setRejectionReason(rejectionReason);
        documentSignerRepository.save(signerEntity);
        documentEntity.setStatus(DocumentStatus.REJECTED);
        documentEntity.setRejectedByAccountId(currentAccountId);
        documentEntity.setRejectedAt(now);
        documentEntity.setRejectionReason(rejectionReason);
        documentEntity.setUpdatedAt(now);
        DocumentEntity savedDocumentEntity = documentRepository.save(documentEntity);
        return toResponseDto(
                savedDocumentEntity,
                documentSignerRepository.findByDocumentId(documentId),
                documentObserverRepository.findByDocumentId(documentId),
                documentSignatureRepository.findByDocumentId(documentId)
        );
    }

    @Override
    @Transactional
    public DocumentResponseDto cancelDocument(UUID currentAccountId, UUID documentId, RejectDocumentRequestDto requestDto) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        if (!documentEntity.getOwnerAccountId().equals(currentAccountId)) {
            throw new DocumentAccessDeniedException("Only document owner can cancel document workflow.");
        }
        if (documentEntity.getStatus() == DocumentStatus.REJECTED || documentEntity.getStatus() == DocumentStatus.CANCELLED || documentEntity.getStatus() == DocumentStatus.FULLY_SIGNED) {
            throw new DocumentRejectedException("Completed, rejected or cancelled document workflow cannot be cancelled.");
        }
        OffsetDateTime now = OffsetDateTime.now();
        documentEntity.setStatus(DocumentStatus.CANCELLED);
        documentEntity.setCancelledByAccountId(currentAccountId);
        documentEntity.setCancelledAt(now);
        documentEntity.setCancellationReason(normalizeOptionalText(requestDto.reason()));
        documentEntity.setUpdatedAt(now);
        DocumentEntity savedDocumentEntity = documentRepository.save(documentEntity);
        return toResponseDto(
                savedDocumentEntity,
                documentSignerRepository.findByDocumentId(documentId),
                documentObserverRepository.findByDocumentId(documentId),
                documentSignatureRepository.findByDocumentId(documentId)
        );
    }

    @Override
    @Transactional
    public void hideDocument(UUID currentAccountId, UUID documentId) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        validateDocumentWorkflowAccess(documentEntity, currentAccountId);
        if (documentHiddenRepository.existsByDocumentIdAndAccountId(documentId, currentAccountId)) {
            return;
        }
        DocumentHiddenEntity hiddenEntity = DocumentHiddenEntity.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .accountId(currentAccountId)
                .hiddenAt(OffsetDateTime.now())
                .build();
        documentHiddenRepository.save(hiddenEntity);
    }

    private DocumentEntity getDocumentEntity(UUID documentId) {
        return documentRepository.findById(documentId)
                .orElseThrow(() -> new DocumentNotFoundException(documentId));
    }

    private List<UUID> normalizeRequiredSignerAccountIds(Collection<UUID> signerAccountIds) {
        if (signerAccountIds == null || signerAccountIds.isEmpty()) {
            throw new DocumentValidationException("At least one required signer is required.");
        }
        List<UUID> normalizedSignerAccountIds = signerAccountIds.stream()
                .filter(accountId -> accountId != null)
                .distinct()
                .toList();
        if (normalizedSignerAccountIds.isEmpty()) {
            throw new DocumentValidationException("At least one required signer is required.");
        }
        return normalizedSignerAccountIds;
    }

    private List<UUID> normalizeObserverAccountIds(Collection<UUID> observerAccountIds, Collection<UUID> signerAccountIds, UUID currentAccountId) {
        HashSet<UUID> excludedAccountIds = new HashSet<>(signerAccountIds);
        excludedAccountIds.add(currentAccountId);
        if (observerAccountIds == null || observerAccountIds.isEmpty()) {
            return List.of();
        }
        return observerAccountIds.stream()
                .filter(accountId -> accountId != null && !excludedAccountIds.contains(accountId))
                .distinct()
                .toList();
    }

    private InternalChatResponseDto validateActiveDocumentChatAccess(UUID chatId, UUID currentAccountId) {
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(chatId);
        boolean activeParticipantExists = chatResponseDto.participants() != null
                && chatResponseDto.participants().stream()
                .anyMatch(participant -> currentAccountId.equals(participant.accountId()) && "ACTIVE".equals(participant.status()));
        if (!activeParticipantExists) {
            throw new DocumentAccessDeniedException("Only active chat participants can create documents in this chat.");
        }
        return chatResponseDto;
    }

    private void validateDocumentWorkflowAccess(DocumentEntity documentEntity, UUID currentAccountId) {
        if (documentEntity.getOwnerAccountId().equals(currentAccountId)) {
            return;
        }
        if (documentSignerRepository.findByDocumentIdAndSignerAccountId(documentEntity.getId(), currentAccountId).isPresent()) {
            return;
        }
        if (documentObserverRepository.findByDocumentIdAndObserverAccountId(documentEntity.getId(), currentAccountId).isPresent()) {
            return;
        }
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(documentEntity.getChatId());
        if (!isDocumentVisibleToAccount(documentEntity, chatResponseDto, currentAccountId)) {
            throw new DocumentAccessDeniedException("Current account cannot access this document.");
        }
    }

    private void validateDocumentCanBeCompleted(DocumentEntity documentEntity) {
        if (documentEntity.getStatus() == DocumentStatus.REJECTED) {
            throw new DocumentRejectedException("Rejected document cannot be signed or rejected again.");
        }
        if (documentEntity.getStatus() == DocumentStatus.CANCELLED) {
            throw new DocumentRejectedException("Cancelled document cannot be signed or rejected.");
        }
        if (documentEntity.getStatus() == DocumentStatus.FULLY_SIGNED) {
            throw new DocumentAlreadySignedException("Fully signed document cannot be changed.");
        }
    }

    private DocumentSignerEntity getPendingSigner(UUID documentId, UUID currentAccountId) {
        DocumentSignerEntity signerEntity = documentSignerRepository.findByDocumentIdAndSignerAccountId(documentId, currentAccountId)
                .orElseThrow(() -> new DocumentAccessDeniedException("Current account is not a required signer for this document."));
        if (signerEntity.getStatus() == DocumentSignerStatus.SIGNED) {
            throw new DocumentAlreadySignedException("Current account already signed this document.");
        }
        if (signerEntity.getStatus() == DocumentSignerStatus.REJECTED) {
            throw new DocumentRejectedException("Current account already rejected this document.");
        }
        return signerEntity;
    }

    private void updateDocumentStatusAfterSignature(DocumentEntity documentEntity, List<DocumentSignerEntity> signerEntities, OffsetDateTime now) {
        boolean everySignerSigned = signerEntities.stream().allMatch(signerEntity -> signerEntity.getStatus() == DocumentSignerStatus.SIGNED);
        boolean atLeastOneSignerSigned = signerEntities.stream().anyMatch(signerEntity -> signerEntity.getStatus() == DocumentSignerStatus.SIGNED);
        documentEntity.setStatus(everySignerSigned ? DocumentStatus.FULLY_SIGNED : atLeastOneSignerSigned ? DocumentStatus.PARTIALLY_SIGNED : DocumentStatus.PENDING_SIGNATURES);
        documentEntity.setUpdatedAt(now);
    }

    private List<DocumentEntity> mergeDocuments(List<DocumentEntity> firstDocuments, List<DocumentEntity> secondDocuments) {
        Map<UUID, DocumentEntity> documentsById = new LinkedHashMap<>();
        firstDocuments.forEach(documentEntity -> documentsById.put(documentEntity.getId(), documentEntity));
        secondDocuments.forEach(documentEntity -> documentsById.put(documentEntity.getId(), documentEntity));
        return documentsById.values()
                .stream()
                .sorted(Comparator.comparing(DocumentEntity::getCreatedAt).reversed())
                .toList();
    }

    private List<DocumentEntity> filterHiddenDocuments(UUID currentAccountId, List<DocumentEntity> documents) {
        List<UUID> documentIds = documents.stream().map(DocumentEntity::getId).toList();
        if (documentIds.isEmpty()) {
            return documents;
        }
        HashSet<UUID> hiddenDocumentIds = documentHiddenRepository.findByAccountIdAndDocumentIdIn(currentAccountId, documentIds)
                .stream()
                .map(DocumentHiddenEntity::getDocumentId)
                .collect(Collectors.toCollection(HashSet::new));
        return documents.stream()
                .filter(documentEntity -> !hiddenDocumentIds.contains(documentEntity.getId()))
                .toList();
    }

    private List<DocumentResponseDto> toResponseDtos(List<DocumentEntity> documents) {
        List<UUID> documentIds = documents.stream().map(DocumentEntity::getId).toList();
        Map<UUID, List<DocumentSignatureEntity>> signaturesByDocumentId = loadSignaturesByDocumentId(documentIds);
        Map<UUID, List<DocumentSignerEntity>> signersByDocumentId = loadSignersByDocumentId(documentIds);
        Map<UUID, List<DocumentObserverEntity>> observersByDocumentId = loadObserversByDocumentId(documentIds);
        return documents.stream()
                .map(documentEntity -> toResponseDto(
                        documentEntity,
                        signersByDocumentId.getOrDefault(documentEntity.getId(), List.of()),
                        observersByDocumentId.getOrDefault(documentEntity.getId(), List.of()),
                        signaturesByDocumentId.getOrDefault(documentEntity.getId(), List.of())
                ))
                .toList();
    }

    private Map<UUID, List<DocumentSignatureEntity>> loadSignaturesByDocumentId(List<UUID> documentIds) {
        if (documentIds.isEmpty()) {
            return Map.of();
        }
        return documentSignatureRepository.findByDocumentIdIn(documentIds)
                .stream()
                .collect(Collectors.groupingBy(DocumentSignatureEntity::getDocumentId));
    }

    private Map<UUID, List<DocumentSignerEntity>> loadSignersByDocumentId(List<UUID> documentIds) {
        if (documentIds.isEmpty()) {
            return Map.of();
        }
        return documentSignerRepository.findByDocumentIdIn(documentIds)
                .stream()
                .collect(Collectors.groupingBy(DocumentSignerEntity::getDocumentId));
    }

    private Map<UUID, List<DocumentObserverEntity>> loadObserversByDocumentId(List<UUID> documentIds) {
        if (documentIds.isEmpty()) {
            return Map.of();
        }
        return documentObserverRepository.findByDocumentIdIn(documentIds)
                .stream()
                .collect(Collectors.groupingBy(DocumentObserverEntity::getDocumentId));
    }

    private boolean isDocumentVisibleToAccount(DocumentEntity documentEntity, InternalChatResponseDto chatResponseDto, UUID currentAccountId) {
        if (documentEntity.getOwnerAccountId().equals(currentAccountId)) {
            return true;
        }
        if (documentSignerRepository.findByDocumentIdAndSignerAccountId(documentEntity.getId(), currentAccountId).isPresent()) {
            return true;
        }
        if (documentObserverRepository.findByDocumentIdAndObserverAccountId(documentEntity.getId(), currentAccountId).isPresent()) {
            return true;
        }
        InternalChatParticipantResponseDto currentParticipant = findCurrentParticipant(chatResponseDto, currentAccountId);
        if (currentParticipant == null) {
            return false;
        }
        return isVisibleAt(currentParticipant, documentEntity.getCreatedAt());
    }

    private InternalChatParticipantResponseDto findCurrentParticipant(InternalChatResponseDto chatResponseDto, UUID currentAccountId) {
        if (chatResponseDto.participants() == null) {
            return null;
        }
        return chatResponseDto.participants()
                .stream()
                .filter(participant -> currentAccountId.equals(participant.accountId()))
                .findFirst()
                .orElse(null);
    }

    private boolean isVisibleAt(InternalChatParticipantResponseDto participant, OffsetDateTime createdAt) {
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

    private String normalizeOptionalText(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private void verifySignature(DeviceDocumentSigningKeyEntity signingKeyEntity, String documentHashBase64, String signatureBase64) {
        try {
            PublicKey publicKey = KeyFactory.getInstance("Ed25519").generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(signingKeyEntity.getPublicKeyBase64())));
            Signature signature = Signature.getInstance("Ed25519");
            signature.initVerify(publicKey);
            signature.update(Base64.getDecoder().decode(documentHashBase64));
            boolean verified = signature.verify(Base64.getDecoder().decode(signatureBase64));
            if (!verified) {
                throw new DocumentValidationException("Document signature is invalid.");
            }
        }
        catch (DocumentValidationException exception) {
            throw exception;
        }
        catch (Exception exception) {
            throw new DocumentValidationException("Failed to verify document signature.", exception);
        }
    }

    private DocumentResponseDto toResponseDto(DocumentEntity documentEntity, List<DocumentSignerEntity> signerEntities, List<DocumentObserverEntity> observerEntities, List<DocumentSignatureEntity> signatureEntities) {
        List<DocumentSignerResponseDto> signerResponseDtos = signerEntities.stream()
                .sorted(Comparator.comparing(DocumentSignerEntity::getCreatedAt))
                .map(this::toSignerResponseDto)
                .toList();
        List<DocumentObserverResponseDto> observerResponseDtos = observerEntities.stream()
                .sorted(Comparator.comparing(DocumentObserverEntity::getCreatedAt))
                .map(this::toObserverResponseDto)
                .toList();
        List<DocumentSignatureResponseDto> signatureResponseDtos = signatureEntities.stream()
                .sorted(Comparator.comparing(DocumentSignatureEntity::getSignedAt))
                .map(this::toSignatureResponseDto)
                .toList();
        return new DocumentResponseDto(
                documentEntity.getId(),
                documentEntity.getChatId(),
                documentEntity.getMediaFileId(),
                documentEntity.getOwnerAccountId(),
                documentEntity.getTitle(),
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
                signerResponseDtos,
                observerResponseDtos,
                signatureResponseDtos
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

    private DocumentObserverResponseDto toObserverResponseDto(DocumentObserverEntity observerEntity) {
        return new DocumentObserverResponseDto(
                observerEntity.getId(),
                observerEntity.getDocumentId(),
                observerEntity.getObserverAccountId(),
                observerEntity.getRole(),
                observerEntity.getCreatedAt()
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
}

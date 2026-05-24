package dev.documentservice.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.documentservice.client.MediaAccessClient;
import dev.documentservice.client.MessagingAccessClient;
import dev.documentservice.exception.DocumentAccessDeniedException;
import dev.documentservice.exception.DocumentAlreadySignedException;
import dev.documentservice.exception.DocumentNotFoundException;
import dev.documentservice.exception.DocumentRejectedException;
import dev.documentservice.exception.DocumentValidationException;
import dev.documentservice.exception.SigningKeyNotFoundException;
import dev.documentservice.mapper.DocumentMapper;
import dev.documentservice.model.dto.request.AddDocumentObserversRequestDto;
import dev.documentservice.model.dto.request.CreateDocumentRequestDto;
import dev.documentservice.model.dto.request.DocumentKeyEnvelopeRequestDto;
import dev.documentservice.model.dto.request.RejectDocumentRequestDto;
import dev.documentservice.model.dto.request.SignDocumentRequestDto;
import dev.documentservice.model.dto.response.DocumentResponseDto;
import dev.documentservice.model.dto.response.InternalChatResponseDto;
import dev.documentservice.model.entity.DeviceDocumentSigningKeyEntity;
import dev.documentservice.model.entity.DocumentEntity;
import dev.documentservice.model.entity.DocumentHiddenEntity;
import dev.documentservice.model.entity.DocumentKeyEnvelopeEntity;
import dev.documentservice.model.entity.DocumentObserverEntity;
import dev.documentservice.model.entity.DocumentSignatureEntity;
import dev.documentservice.model.entity.DocumentSignerEntity;
import dev.documentservice.model.enumeration.DocumentEventType;
import dev.documentservice.model.enumeration.DocumentObserverRole;
import dev.documentservice.model.enumeration.DocumentSignerStatus;
import dev.documentservice.model.enumeration.DocumentSigningKeyStatus;
import dev.documentservice.model.enumeration.DocumentStatus;
import dev.documentservice.model.enumeration.SignatureAlgorithm;
import dev.documentservice.model.event.DocumentEventDto;
import dev.documentservice.observability.RequestIdProvider;
import dev.documentservice.outbox.DocumentEventPublisher;
import dev.documentservice.repository.DeviceDocumentSigningKeyRepository;
import dev.documentservice.repository.DocumentHiddenRepository;
import dev.documentservice.repository.DocumentKeyEnvelopeRepository;
import dev.documentservice.repository.DocumentObserverRepository;
import dev.documentservice.repository.DocumentRepository;
import dev.documentservice.repository.DocumentSignatureRepository;
import dev.documentservice.repository.DocumentSignerRepository;
import dev.documentservice.service.DocumentService;
import dev.documentservice.service.document.DocumentAccessPolicy;
import dev.documentservice.service.document.DocumentSignatureVerifier;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentServiceImpl implements DocumentService {
    private static final String DOCUMENT_KEY_ENVELOPE_ALGORITHM = "RSA-OAEP-SHA256";

    private final DocumentRepository documentRepository;
    private final DocumentSignatureRepository documentSignatureRepository;
    private final DocumentSignerRepository documentSignerRepository;
    private final DocumentObserverRepository documentObserverRepository;
    private final DocumentHiddenRepository documentHiddenRepository;
    private final DocumentKeyEnvelopeRepository documentKeyEnvelopeRepository;
    private final DeviceDocumentSigningKeyRepository deviceDocumentSigningKeyRepository;
    private final MessagingAccessClient messagingAccessClient;
    private final MediaAccessClient mediaAccessClient;
    private final DocumentEventPublisher documentEventPublisher;
    private final RequestIdProvider requestIdProvider;
    private final DocumentMapper documentMapper;
    private final DocumentAccessPolicy documentAccessPolicy;
    private final DocumentSignatureVerifier documentSignatureVerifier;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public DocumentResponseDto createDocument(UUID currentAccountId, CreateDocumentRequestDto requestDto) {
        if (requestDto.chatId() != null) {
            validateActiveDocumentChatAccess(requestDto.chatId(), currentAccountId);
        }
        List<UUID> signerAccountIds = normalizeRequiredSignerAccountIds(requestDto.requiredSignerAccountIds());
        List<UUID> observerAccountIds = normalizeObserverAccountIds(requestDto.observerAccountIds(), signerAccountIds, currentAccountId);
        OffsetDateTime now = OffsetDateTime.now();
        DocumentEntity documentEntity = createDocumentEntity(currentAccountId, requestDto, now);
        DocumentEntity savedDocumentEntity = documentRepository.save(documentEntity);
        List<DocumentSignerEntity> signerEntities = createSignerEntities(savedDocumentEntity.getId(), signerAccountIds, now);
        List<DocumentObserverEntity> observerEntities = createObserverEntities(savedDocumentEntity.getId(), observerAccountIds, now);
        documentSignerRepository.saveAll(signerEntities);
        documentObserverRepository.saveAll(observerEntities);
        HashSet<UUID> accessAccountIds = collectAccessAccountIds(savedDocumentEntity, signerEntities, observerEntities);
        List<DocumentKeyEnvelopeEntity> keyEnvelopeEntities = createKeyEnvelopeEntities(savedDocumentEntity.getId(), requestDto.fileEncryption().keyEnvelopes(), accessAccountIds, now);
        documentKeyEnvelopeRepository.saveAll(keyEnvelopeEntities);
        mediaAccessClient.grantMediaAccess(savedDocumentEntity.getMediaFileId(), accessAccountIds);
        DocumentResponseDto responseDto = documentMapper.toResponseDto(savedDocumentEntity, signerEntities, observerEntities, List.of(), filterKeyEnvelopesForAccount(keyEnvelopeEntities, currentAccountId), false);
        publishDocumentEvent(DocumentEventType.DOCUMENT_CREATED, savedDocumentEntity, responseDto, accessAccountIds);
        log.info("Document workflow created. documentId={} ownerAccountId={} signerCount={} observerCount={}", savedDocumentEntity.getId(), currentAccountId, signerEntities.size(), observerEntities.size());
        return responseDto;
    }

    @Override
    @Transactional(readOnly = true)
    public DocumentResponseDto getDocument(UUID currentAccountId, UUID documentId) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        validateDocumentWorkflowAccess(documentEntity, currentAccountId);
        return toResponseDto(currentAccountId, documentEntity);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponseDto> getCurrentAccountDocuments(UUID currentAccountId, boolean includeHidden) {
        List<DocumentEntity> ownedDocuments = documentRepository.findByOwnerAccountIdOrderByCreatedAtDesc(currentAccountId);
        List<DocumentEntity> signerDocuments = findDocumentsBySigner(currentAccountId);
        List<DocumentEntity> observerDocuments = findDocumentsByObserver(currentAccountId);
        List<DocumentEntity> documents = mergeDocuments(mergeDocuments(ownedDocuments, signerDocuments), observerDocuments);
        List<DocumentEntity> visibleDocuments = includeHidden ? documents : filterHiddenDocuments(currentAccountId, documents);
        return toResponseDtos(currentAccountId, visibleDocuments);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponseDto> getChatDocuments(UUID currentAccountId, UUID chatId) {
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(chatId);
        List<DocumentEntity> documents = documentRepository.findByChatIdOrderByCreatedAtDesc(chatId).stream()
            .filter(documentEntity -> documentAccessPolicy.isDocumentVisibleToAccount(documentEntity, chatResponseDto, currentAccountId))
            .toList();
        return toResponseDtos(currentAccountId, filterHiddenDocuments(currentAccountId, documents));
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
        DeviceDocumentSigningKeyEntity signingKeyEntity = deviceDocumentSigningKeyRepository.findByAccountIdAndDeviceIdAndFingerprintAndStatus(
            currentAccountId,
            requestDto.signerDeviceId(),
            requestDto.signingKeyFingerprint(),
            DocumentSigningKeyStatus.ACTIVE
        ).orElseThrow(() -> new SigningKeyNotFoundException("Active document signing key was not found for current device."));
        documentSignatureVerifier.verifySignature(signingKeyEntity, requestDto.documentHashBase64(), requestDto.signatureBase64());
        OffsetDateTime now = OffsetDateTime.now();
        DocumentSignatureEntity signatureEntity = createSignatureEntity(documentId, currentAccountId, requestDto, now);
        DocumentSignatureEntity savedSignatureEntity = documentSignatureRepository.save(signatureEntity);
        markSignerSigned(signerEntity, now);
        List<DocumentSignerEntity> signerEntities = documentSignerRepository.findByDocumentId(documentId);
        updateDocumentStatusAfterSignature(documentEntity, signerEntities, now);
        DocumentEntity savedDocumentEntity = documentRepository.save(documentEntity);
        List<DocumentSignatureEntity> signatureEntities = new ArrayList<>(documentSignatureRepository.findByDocumentId(documentId));
        if (signatureEntities.stream().noneMatch(existingSignature -> existingSignature.getId().equals(savedSignatureEntity.getId()))) {
            signatureEntities.add(savedSignatureEntity);
        }
        List<DocumentObserverEntity> observerEntities = documentObserverRepository.findByDocumentId(documentId);
        List<DocumentKeyEnvelopeEntity> keyEnvelopeEntities = documentKeyEnvelopeRepository.findByDocumentIdAndTargetAccountId(documentId, currentAccountId);
        DocumentResponseDto responseDto = documentMapper.toResponseDto(savedDocumentEntity, signerEntities, observerEntities, signatureEntities, keyEnvelopeEntities, false);
        publishDocumentEvent(DocumentEventType.DOCUMENT_SIGNED, savedDocumentEntity, responseDto, collectAccessAccountIds(savedDocumentEntity, signerEntities, observerEntities));
        log.info("Document signed. documentId={} signerAccountId={} signerDeviceId={}", documentId, currentAccountId, requestDto.signerDeviceId());
        return responseDto;
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
        DocumentResponseDto responseDto = toResponseDto(currentAccountId, savedDocumentEntity);
        publishDocumentEvent(DocumentEventType.DOCUMENT_REJECTED, savedDocumentEntity, responseDto, collectAccessAccountIds(savedDocumentEntity, documentSignerRepository.findByDocumentId(documentId), documentObserverRepository.findByDocumentId(documentId)));
        log.info("Document rejected. documentId={} signerAccountId={}", documentId, currentAccountId);
        return responseDto;
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
        DocumentResponseDto responseDto = toResponseDto(currentAccountId, savedDocumentEntity);
        publishDocumentEvent(DocumentEventType.DOCUMENT_CANCELLED, savedDocumentEntity, responseDto, collectAccessAccountIds(savedDocumentEntity, documentSignerRepository.findByDocumentId(documentId), documentObserverRepository.findByDocumentId(documentId)));
        log.info("Document cancelled. documentId={} ownerAccountId={}", documentId, currentAccountId);
        return responseDto;
    }

    @Override
    @Transactional
    public DocumentResponseDto addObservers(UUID currentAccountId, UUID documentId, AddDocumentObserversRequestDto requestDto) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        if (!documentEntity.getOwnerAccountId().equals(currentAccountId)) {
            throw new DocumentAccessDeniedException("Only document owner can add observers.");
        }
        if (documentEntity.getStatus() == DocumentStatus.CANCELLED) {
            throw new DocumentRejectedException("Cancelled document cannot be changed.");
        }
        List<DocumentSignerEntity> signerEntities = documentSignerRepository.findByDocumentId(documentId);
        HashSet<UUID> excludedAccountIds = collectExcludedObserverAccountIds(documentEntity, signerEntities);
        OffsetDateTime now = OffsetDateTime.now();
        List<DocumentObserverEntity> newObserverEntities = requestDto.observerAccountIds().stream()
            .filter(accountId -> !excludedAccountIds.contains(accountId))
            .distinct()
            .map(accountId -> createObserverEntity(documentId, accountId, now))
            .toList();
        if (!newObserverEntities.isEmpty()) {
            List<UUID> newObserverAccountIds = newObserverEntities.stream().map(DocumentObserverEntity::getObserverAccountId).toList();
            List<DocumentKeyEnvelopeEntity> keyEnvelopeEntities = createKeyEnvelopeEntities(documentId, requestDto.keyEnvelopes(), newObserverAccountIds, now);
            documentObserverRepository.saveAll(newObserverEntities);
            documentKeyEnvelopeRepository.saveAll(keyEnvelopeEntities);
            mediaAccessClient.grantMediaAccess(documentEntity.getMediaFileId(), newObserverAccountIds);
        }
        List<DocumentObserverEntity> observerEntities = documentObserverRepository.findByDocumentId(documentId);
        DocumentResponseDto responseDto = toResponseDto(currentAccountId, documentEntity);
        publishDocumentEvent(DocumentEventType.DOCUMENT_OBSERVERS_ADDED, documentEntity, responseDto, collectAccessAccountIds(documentEntity, signerEntities, observerEntities));
        log.info("Document observers added. documentId={} ownerAccountId={} addedCount={}", documentId, currentAccountId, newObserverEntities.size());
        return responseDto;
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
        publishDocumentEvent(DocumentEventType.DOCUMENT_HIDDEN, documentEntity, null, List.of(currentAccountId));
        log.info("Document hidden. documentId={} accountId={}", documentId, currentAccountId);
    }

    @Override
    @Transactional
    public void restoreDocument(UUID currentAccountId, UUID documentId) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        validateDocumentWorkflowAccess(documentEntity, currentAccountId);
        documentHiddenRepository.deleteByDocumentIdAndAccountId(documentId, currentAccountId);
        publishDocumentEvent(DocumentEventType.DOCUMENT_UPDATED, documentEntity, toResponseDto(currentAccountId, documentEntity), List.of(currentAccountId));
        log.info("Document restored. documentId={} accountId={}", documentId, currentAccountId);
    }

    private DocumentEntity createDocumentEntity(UUID currentAccountId, CreateDocumentRequestDto requestDto, OffsetDateTime now) {
        return DocumentEntity.builder()
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
            .fileEncryptionAlgorithm(requestDto.fileEncryption().algorithm())
            .fileInitializationVectorBase64(requestDto.fileEncryption().initializationVectorBase64())
            .status(DocumentStatus.PENDING_SIGNATURES)
            .createdAt(now)
            .updatedAt(now)
            .build();
    }

    private List<DocumentSignerEntity> createSignerEntities(UUID documentId, List<UUID> signerAccountIds, OffsetDateTime now) {
        return signerAccountIds.stream()
            .map(signerAccountId -> DocumentSignerEntity.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .signerAccountId(signerAccountId)
                .status(DocumentSignerStatus.PENDING)
                .createdAt(now)
                .build())
            .toList();
    }

    private List<DocumentObserverEntity> createObserverEntities(UUID documentId, List<UUID> observerAccountIds, OffsetDateTime now) {
        return observerAccountIds.stream().map(observerAccountId -> createObserverEntity(documentId, observerAccountId, now)).toList();
    }

    private DocumentObserverEntity createObserverEntity(UUID documentId, UUID observerAccountId, OffsetDateTime now) {
        return DocumentObserverEntity.builder()
            .id(UUID.randomUUID())
            .documentId(documentId)
            .observerAccountId(observerAccountId)
            .role(DocumentObserverRole.OBSERVER)
            .createdAt(now)
            .build();
    }

    private List<DocumentKeyEnvelopeEntity> createKeyEnvelopeEntities(UUID documentId, List<DocumentKeyEnvelopeRequestDto> keyEnvelopeRequestDtos, Collection<UUID> accessAccountIds, OffsetDateTime now) {
        if (keyEnvelopeRequestDtos == null || keyEnvelopeRequestDtos.isEmpty()) {
            throw new DocumentValidationException("Document key envelopes are required.");
        }

        validateKeyEnvelopeRequests(keyEnvelopeRequestDtos);

        HashSet<UUID> allowedAccountIds = accessAccountIds.stream()
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(HashSet::new));

        HashSet<UUID> envelopeAccountIds = keyEnvelopeRequestDtos.stream()
            .map(DocumentKeyEnvelopeRequestDto::targetAccountId)
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(HashSet::new));

        if (!envelopeAccountIds.equals(allowedAccountIds)) {
            throw new DocumentValidationException("Document key envelopes must exactly match document access accounts.");
        }

        return keyEnvelopeRequestDtos.stream()
            .map(keyEnvelope -> DocumentKeyEnvelopeEntity.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .targetAccountId(keyEnvelope.targetAccountId())
                .targetDeviceId(keyEnvelope.targetDeviceId())
                .algorithm(keyEnvelope.algorithm())
                .encryptedKeyBase64(keyEnvelope.encryptedKeyBase64())
                .createdAt(now)
                .build())
            .toList();
    }

    private void validateKeyEnvelopeRequests(List<DocumentKeyEnvelopeRequestDto> keyEnvelopeRequestDtos) {
        boolean hasInvalidEnvelope = keyEnvelopeRequestDtos.stream()
            .anyMatch(keyEnvelopeRequestDto -> keyEnvelopeRequestDto == null
                || keyEnvelopeRequestDto.targetAccountId() == null
                || !DOCUMENT_KEY_ENVELOPE_ALGORITHM.equals(keyEnvelopeRequestDto.algorithm())
                || !StringUtils.hasText(keyEnvelopeRequestDto.encryptedKeyBase64()));

        if (hasInvalidEnvelope) {
            throw new DocumentValidationException("Document key envelopes contain invalid data.");
        }
    }

    private DocumentEntity getDocumentEntity(UUID documentId) {
        return documentRepository.findById(documentId).orElseThrow(() -> new DocumentNotFoundException(documentId));
    }

    private List<UUID> normalizeRequiredSignerAccountIds(Collection<UUID> signerAccountIds) {
        if (signerAccountIds == null || signerAccountIds.isEmpty()) {
            throw new DocumentValidationException("At least one required signer is required.");
        }
        List<UUID> normalizedSignerAccountIds = signerAccountIds.stream().filter(Objects::nonNull).distinct().toList();
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
        return observerAccountIds.stream().filter(accountId -> accountId != null && !excludedAccountIds.contains(accountId)).distinct().toList();
    }

    private void validateActiveDocumentChatAccess(UUID chatId, UUID currentAccountId) {
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(chatId);
        boolean activeParticipantExists = chatResponseDto.participants() != null
            && chatResponseDto.participants().stream().anyMatch(participant -> currentAccountId.equals(participant.accountId()) && "ACTIVE".equals(participant.status()));
        if (!activeParticipantExists) {
            throw new DocumentAccessDeniedException("Only active chat participants can create documents in this chat.");
        }
    }

    private void validateDocumentWorkflowAccess(DocumentEntity documentEntity, UUID currentAccountId) {
        if (documentAccessPolicy.hasDirectWorkflowAccess(documentEntity, currentAccountId)) {
            return;
        }
        if (documentEntity.getChatId() == null) {
            throw new DocumentAccessDeniedException("Current account cannot access this document.");
        }
        InternalChatResponseDto chatResponseDto = messagingAccessClient.validateCurrentAccountCanAccessChat(documentEntity.getChatId());
        if (!documentAccessPolicy.isDocumentVisibleToAccount(documentEntity, chatResponseDto, currentAccountId)) {
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

    private DocumentSignatureEntity createSignatureEntity(UUID documentId, UUID currentAccountId, SignDocumentRequestDto requestDto, OffsetDateTime now) {
        return DocumentSignatureEntity.builder()
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
    }

    private void markSignerSigned(DocumentSignerEntity signerEntity, OffsetDateTime now) {
        signerEntity.setStatus(DocumentSignerStatus.SIGNED);
        signerEntity.setSignedAt(now);
        signerEntity.setRejectedAt(null);
        signerEntity.setRejectionReason(null);
        documentSignerRepository.save(signerEntity);
    }

    private void updateDocumentStatusAfterSignature(DocumentEntity documentEntity, List<DocumentSignerEntity> signerEntities, OffsetDateTime now) {
        boolean everyRequiredSignerSigned = signerEntities.stream().allMatch(signerEntity -> signerEntity.getStatus() == DocumentSignerStatus.SIGNED);
        boolean atLeastOneSignerSigned = signerEntities.stream().anyMatch(signerEntity -> signerEntity.getStatus() == DocumentSignerStatus.SIGNED);
        documentEntity.setStatus(everyRequiredSignerSigned ? DocumentStatus.FULLY_SIGNED : atLeastOneSignerSigned ? DocumentStatus.PARTIALLY_SIGNED : DocumentStatus.PENDING_SIGNATURES);
        documentEntity.setUpdatedAt(now);
    }

    private List<DocumentEntity> findDocumentsBySigner(UUID accountId) {
        List<UUID> documentIds = documentSignerRepository.findBySignerAccountIdOrderByCreatedAtDesc(accountId).stream().map(DocumentSignerEntity::getDocumentId).distinct().toList();
        return documentIds.isEmpty() ? List.of() : documentRepository.findByIdInOrderByCreatedAtDesc(documentIds);
    }

    private List<DocumentEntity> findDocumentsByObserver(UUID accountId) {
        List<UUID> documentIds = documentObserverRepository.findByObserverAccountIdOrderByCreatedAtDesc(accountId).stream().map(DocumentObserverEntity::getDocumentId).distinct().toList();
        return documentIds.isEmpty() ? List.of() : documentRepository.findByIdInOrderByCreatedAtDesc(documentIds);
    }

    private List<DocumentEntity> mergeDocuments(List<DocumentEntity> firstDocuments, List<DocumentEntity> secondDocuments) {
        Map<UUID, DocumentEntity> documentsById = new LinkedHashMap<>();
        firstDocuments.forEach(documentEntity -> documentsById.put(documentEntity.getId(), documentEntity));
        secondDocuments.forEach(documentEntity -> documentsById.put(documentEntity.getId(), documentEntity));
        return documentsById.values().stream().sorted(Comparator.comparing(DocumentEntity::getCreatedAt).reversed()).toList();
    }

    private List<DocumentEntity> filterHiddenDocuments(UUID currentAccountId, List<DocumentEntity> documents) {
        List<UUID> documentIds = documents.stream().map(DocumentEntity::getId).toList();
        if (documentIds.isEmpty()) {
            return documents;
        }
        HashSet<UUID> hiddenDocumentIds = documentHiddenRepository.findByAccountIdAndDocumentIdIn(currentAccountId, documentIds).stream().map(DocumentHiddenEntity::getDocumentId).collect(Collectors.toCollection(HashSet::new));
        return documents.stream().filter(documentEntity -> !hiddenDocumentIds.contains(documentEntity.getId())).toList();
    }

    private List<DocumentResponseDto> toResponseDtos(UUID currentAccountId, List<DocumentEntity> documents) {
        List<UUID> documentIds = documents.stream().map(DocumentEntity::getId).toList();
        Map<UUID, List<DocumentSignatureEntity>> signaturesByDocumentId = loadSignaturesByDocumentId(documentIds);
        Map<UUID, List<DocumentSignerEntity>> signersByDocumentId = loadSignersByDocumentId(documentIds);
        Map<UUID, List<DocumentObserverEntity>> observersByDocumentId = loadObserversByDocumentId(documentIds);
        Map<UUID, List<DocumentKeyEnvelopeEntity>> keyEnvelopesByDocumentId = loadKeyEnvelopesByDocumentId(currentAccountId, documentIds);
        HashSet<UUID> hiddenDocumentIds = loadHiddenDocumentIds(currentAccountId, documentIds);
        return documents.stream().map(documentEntity -> documentMapper.toResponseDto(
            documentEntity,
            signersByDocumentId.getOrDefault(documentEntity.getId(), List.of()),
            observersByDocumentId.getOrDefault(documentEntity.getId(), List.of()),
            signaturesByDocumentId.getOrDefault(documentEntity.getId(), List.of()),
            keyEnvelopesByDocumentId.getOrDefault(documentEntity.getId(), List.of()),
            hiddenDocumentIds.contains(documentEntity.getId())
        )).toList();
    }

    private DocumentResponseDto toResponseDto(UUID currentAccountId, DocumentEntity documentEntity) {
        return documentMapper.toResponseDto(
            documentEntity,
            documentSignerRepository.findByDocumentId(documentEntity.getId()),
            documentObserverRepository.findByDocumentId(documentEntity.getId()),
            documentSignatureRepository.findByDocumentId(documentEntity.getId()),
            documentKeyEnvelopeRepository.findByDocumentIdAndTargetAccountId(documentEntity.getId(), currentAccountId),
            documentHiddenRepository.existsByDocumentIdAndAccountId(documentEntity.getId(), currentAccountId)
        );
    }

    private HashSet<UUID> loadHiddenDocumentIds(UUID currentAccountId, List<UUID> documentIds) {
        if (currentAccountId == null || documentIds.isEmpty()) {
            return new HashSet<>();
        }
        return documentHiddenRepository.findByAccountIdAndDocumentIdIn(currentAccountId, documentIds).stream().map(DocumentHiddenEntity::getDocumentId).collect(Collectors.toCollection(HashSet::new));
    }

    private Map<UUID, List<DocumentSignatureEntity>> loadSignaturesByDocumentId(List<UUID> documentIds) {
        return documentIds.isEmpty() ? Map.of() : documentSignatureRepository.findByDocumentIdIn(documentIds).stream().collect(Collectors.groupingBy(DocumentSignatureEntity::getDocumentId));
    }

    private Map<UUID, List<DocumentSignerEntity>> loadSignersByDocumentId(List<UUID> documentIds) {
        return documentIds.isEmpty() ? Map.of() : documentSignerRepository.findByDocumentIdIn(documentIds).stream().collect(Collectors.groupingBy(DocumentSignerEntity::getDocumentId));
    }

    private Map<UUID, List<DocumentObserverEntity>> loadObserversByDocumentId(List<UUID> documentIds) {
        return documentIds.isEmpty() ? Map.of() : documentObserverRepository.findByDocumentIdIn(documentIds).stream().collect(Collectors.groupingBy(DocumentObserverEntity::getDocumentId));
    }

    private Map<UUID, List<DocumentKeyEnvelopeEntity>> loadKeyEnvelopesByDocumentId(UUID currentAccountId, List<UUID> documentIds) {
        return documentIds.isEmpty() ? Map.of() : documentKeyEnvelopeRepository.findByDocumentIdIn(documentIds).stream()
            .filter(keyEnvelopeEntity -> currentAccountId.equals(keyEnvelopeEntity.getTargetAccountId()))
            .collect(Collectors.groupingBy(DocumentKeyEnvelopeEntity::getDocumentId));
    }

    private List<DocumentKeyEnvelopeEntity> filterKeyEnvelopesForAccount(List<DocumentKeyEnvelopeEntity> keyEnvelopeEntities, UUID accountId) {
        return keyEnvelopeEntities.stream().filter(keyEnvelopeEntity -> accountId.equals(keyEnvelopeEntity.getTargetAccountId())).toList();
    }

    private HashSet<UUID> collectAccessAccountIds(DocumentEntity documentEntity, List<DocumentSignerEntity> signerEntities, List<DocumentObserverEntity> observerEntities) {
        HashSet<UUID> accountIds = new HashSet<>();
        accountIds.add(documentEntity.getOwnerAccountId());
        signerEntities.forEach(signerEntity -> accountIds.add(signerEntity.getSignerAccountId()));
        observerEntities.forEach(observerEntity -> accountIds.add(observerEntity.getObserverAccountId()));
        return accountIds;
    }

    private HashSet<UUID> collectExcludedObserverAccountIds(DocumentEntity documentEntity, List<DocumentSignerEntity> signerEntities) {
        HashSet<UUID> excludedAccountIds = signerEntities.stream().map(DocumentSignerEntity::getSignerAccountId).collect(Collectors.toCollection(HashSet::new));
        excludedAccountIds.add(documentEntity.getOwnerAccountId());
        documentObserverRepository.findByDocumentId(documentEntity.getId()).forEach(observerEntity -> excludedAccountIds.add(observerEntity.getObserverAccountId()));
        return excludedAccountIds;
    }

    private void publishDocumentEvent(DocumentEventType eventType, DocumentEntity documentEntity, DocumentResponseDto responseDto, Collection<UUID> recipientAccountIds) {
        HashMap<String, Object> payload = new HashMap<>();
        payload.put("documentId", documentEntity.getId());
        payload.put("document", responseDto);
        DocumentEventDto documentEventDto = new DocumentEventDto(
            UUID.randomUUID(),
            eventType,
            documentEntity.getChatId(),
            null,
            documentEntity.getOwnerAccountId(),
            recipientAccountIds == null ? List.of() : recipientAccountIds.stream().filter(Objects::nonNull).distinct().toList(),
            OffsetDateTime.now(),
            requestIdProvider.getCurrentRequestId(),
            objectMapper.valueToTree(payload)
        );
        documentEventPublisher.publish(documentEventDto);
    }

    private String normalizeOptionalText(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}

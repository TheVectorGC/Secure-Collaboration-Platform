package dev.documentservice.service.impl;

import dev.documentservice.client.MessagingAccessClient;
import dev.documentservice.exception.DocumentAccessDeniedException;
import dev.documentservice.exception.DocumentAlreadySignedException;
import dev.documentservice.exception.DocumentNotFoundException;
import dev.documentservice.exception.DocumentRejectedException;
import dev.documentservice.exception.DocumentValidationException;
import dev.documentservice.exception.SigningKeyNotFoundException;
import dev.documentservice.model.dto.request.CreateDocumentRequestDto;
import dev.documentservice.model.dto.request.SignDocumentRequestDto;
import dev.documentservice.model.dto.response.DocumentResponseDto;
import dev.documentservice.model.dto.response.DocumentSignatureResponseDto;
import dev.documentservice.model.dto.response.InternalChatResponseDto;
import dev.documentservice.model.entity.DeviceDocumentSigningKeyEntity;
import dev.documentservice.model.entity.DocumentEntity;
import dev.documentservice.model.entity.DocumentSignatureEntity;
import dev.documentservice.model.enumeration.DocumentSigningKeyStatus;
import dev.documentservice.model.enumeration.DocumentStatus;
import dev.documentservice.model.enumeration.SignatureAlgorithm;
import dev.documentservice.repository.DeviceDocumentSigningKeyRepository;
import dev.documentservice.repository.DocumentRepository;
import dev.documentservice.repository.DocumentSignatureRepository;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentServiceImpl implements dev.documentservice.service.DocumentService {
    private final DocumentRepository documentRepository;
    private final DocumentSignatureRepository documentSignatureRepository;
    private final DeviceDocumentSigningKeyRepository deviceDocumentSigningKeyRepository;
    private final MessagingAccessClient messagingAccessClient;

    @Override
    @Transactional
    public DocumentResponseDto createDocument(UUID currentAccountId, CreateDocumentRequestDto requestDto) {
        messagingAccessClient.validateCurrentAccountCanAccessChat(requestDto.chatId());
        OffsetDateTime now = OffsetDateTime.now();
        DocumentEntity documentEntity = DocumentEntity.builder()
                .id(UUID.randomUUID())
                .chatId(requestDto.chatId())
                .mediaFileId(requestDto.mediaFileId())
                .ownerAccountId(currentAccountId)
                .fileName(requestDto.fileName())
                .mimeType(requestDto.mimeType())
                .sizeBytes(requestDto.sizeBytes())
                .plaintextSha256Base64(requestDto.plaintextSha256Base64())
                .encryptedSha256Base64(requestDto.encryptedSha256Base64())
                .status(DocumentStatus.ACTIVE)
                .createdAt(now)
                .updatedAt(now)
                .build();

        DocumentEntity savedDocumentEntity = documentRepository.save(documentEntity);
        log.info("Document created. Document ID: {}, chat ID: {}.", savedDocumentEntity.getId(), savedDocumentEntity.getChatId());
        return toResponseDto(savedDocumentEntity, List.of());
    }

    @Override
    @Transactional(readOnly = true)
    public DocumentResponseDto getDocument(UUID currentAccountId, UUID documentId) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        messagingAccessClient.validateCurrentAccountCanAccessChat(documentEntity.getChatId());
        return toResponseDto(documentEntity, documentSignatureRepository.findByDocumentId(documentId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponseDto> getCurrentAccountDocuments(UUID currentAccountId) {
        List<UUID> accessibleChatIds = messagingAccessClient.getCurrentAccountChats()
                .stream()
                .map(InternalChatResponseDto::chatId)
                .toList();

        if (accessibleChatIds.isEmpty()) {
            return List.of();
        }

        List<DocumentEntity> documents = documentRepository.findByChatIdInOrderByCreatedAtDesc(accessibleChatIds);
        Map<UUID, List<DocumentSignatureEntity>> signaturesByDocumentId = loadSignaturesByDocumentId(documents.stream().map(DocumentEntity::getId).toList());

        return documents.stream()
                .map(documentEntity -> toResponseDto(documentEntity, signaturesByDocumentId.getOrDefault(documentEntity.getId(), List.of())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponseDto> getChatDocuments(UUID currentAccountId, UUID chatId) {
        messagingAccessClient.validateCurrentAccountCanAccessChat(chatId);
        List<DocumentEntity> documents = documentRepository.findByChatIdOrderByCreatedAtDesc(chatId);
        Map<UUID, List<DocumentSignatureEntity>> signaturesByDocumentId = loadSignaturesByDocumentId(documents.stream().map(DocumentEntity::getId).toList());

        return documents.stream()
                .map(documentEntity -> toResponseDto(documentEntity, signaturesByDocumentId.getOrDefault(documentEntity.getId(), List.of())))
                .toList();
    }

    @Override
    @Transactional
    public DocumentResponseDto signDocument(UUID currentAccountId, UUID documentId, SignDocumentRequestDto requestDto) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        messagingAccessClient.validateCurrentAccountCanAccessChat(documentEntity.getChatId());

        if (documentEntity.getStatus() == DocumentStatus.REJECTED) {
            throw new DocumentRejectedException("Rejected document cannot be signed.");
        }

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

        DocumentSignatureEntity signatureEntity = DocumentSignatureEntity.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .signerAccountId(currentAccountId)
                .signerDeviceId(requestDto.signerDeviceId())
                .signingKeyFingerprint(requestDto.signingKeyFingerprint())
                .algorithm(SignatureAlgorithm.ED25519)
                .documentHashBase64(requestDto.documentHashBase64())
                .signatureBase64(requestDto.signatureBase64())
                .signedAt(OffsetDateTime.now())
                .build();

        documentSignatureRepository.save(signatureEntity);
        log.info("Document signed. Document ID: {}, signer account ID: {}.", documentId, currentAccountId);
        return toResponseDto(documentEntity, documentSignatureRepository.findByDocumentId(documentId));
    }

    @Override
    @Transactional
    public DocumentResponseDto rejectDocument(UUID currentAccountId, UUID documentId) {
        DocumentEntity documentEntity = getDocumentEntity(documentId);
        messagingAccessClient.validateCurrentAccountCanAccessChat(documentEntity.getChatId());

        if (documentSignatureRepository.existsByDocumentIdAndSignerAccountId(documentId, currentAccountId)) {
            throw new DocumentValidationException("Signed document cannot be rejected by the same account.");
        }

        documentEntity.setStatus(DocumentStatus.REJECTED);
        documentEntity.setRejectedByAccountId(currentAccountId);
        documentEntity.setRejectedAt(OffsetDateTime.now());
        documentEntity.setUpdatedAt(OffsetDateTime.now());
        DocumentEntity savedDocumentEntity = documentRepository.save(documentEntity);
        return toResponseDto(savedDocumentEntity, documentSignatureRepository.findByDocumentId(documentId));
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

    private DocumentResponseDto toResponseDto(DocumentEntity documentEntity, List<DocumentSignatureEntity> signatureEntities) {
        List<DocumentSignatureResponseDto> signatures = signatureEntities.stream()
                .sorted(Comparator.comparing(DocumentSignatureEntity::getSignedAt))
                .map(this::toSignatureResponseDto)
                .toList();

        return new DocumentResponseDto(
                documentEntity.getId(),
                documentEntity.getChatId(),
                documentEntity.getMediaFileId(),
                documentEntity.getOwnerAccountId(),
                documentEntity.getFileName(),
                documentEntity.getMimeType(),
                documentEntity.getSizeBytes(),
                documentEntity.getPlaintextSha256Base64(),
                documentEntity.getEncryptedSha256Base64(),
                documentEntity.getStatus(),
                documentEntity.getRejectedByAccountId(),
                documentEntity.getRejectedAt(),
                documentEntity.getCreatedAt(),
                documentEntity.getUpdatedAt(),
                signatures
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

package dev.documentservice.mapper;

import dev.documentservice.model.dto.response.DocumentFileEncryptionResponseDto;
import dev.documentservice.model.dto.response.DocumentKeyEnvelopeResponseDto;
import dev.documentservice.model.dto.response.DocumentObserverResponseDto;
import dev.documentservice.model.dto.response.DocumentResponseDto;
import dev.documentservice.model.dto.response.DocumentSignatureResponseDto;
import dev.documentservice.model.dto.response.DocumentSignerResponseDto;
import dev.documentservice.model.entity.DocumentEntity;
import dev.documentservice.model.entity.DocumentKeyEnvelopeEntity;
import dev.documentservice.model.entity.DocumentObserverEntity;
import dev.documentservice.model.entity.DocumentSignatureEntity;
import dev.documentservice.model.entity.DocumentSignerEntity;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class DocumentMapper {
    public DocumentResponseDto toResponseDto(
        DocumentEntity documentEntity,
        List<DocumentSignerEntity> signerEntities,
        List<DocumentObserverEntity> observerEntities,
        List<DocumentSignatureEntity> signatureEntities,
        List<DocumentKeyEnvelopeEntity> keyEnvelopeEntities,
        boolean hiddenForCurrentAccount
    ) {
        List<DocumentSignerResponseDto> signerResponseDtos = signerEntities.stream().sorted(Comparator.comparing(DocumentSignerEntity::getCreatedAt)).map(this::toSignerResponseDto).toList();
        List<DocumentObserverResponseDto> observerResponseDtos = observerEntities.stream().sorted(Comparator.comparing(DocumentObserverEntity::getCreatedAt)).map(this::toObserverResponseDto).toList();
        List<DocumentSignatureResponseDto> signatureResponseDtos = signatureEntities.stream().sorted(Comparator.comparing(DocumentSignatureEntity::getSignedAt)).map(this::toSignatureResponseDto).toList();
        List<DocumentKeyEnvelopeResponseDto> keyEnvelopeResponseDtos = keyEnvelopeEntities.stream().map(this::toKeyEnvelopeResponseDto).toList();
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
            signatureResponseDtos,
            hiddenForCurrentAccount,
            new DocumentFileEncryptionResponseDto(documentEntity.getFileEncryptionAlgorithm(), documentEntity.getFileInitializationVectorBase64(), keyEnvelopeResponseDtos)
        );
    }

    public DocumentSignerResponseDto toSignerResponseDto(DocumentSignerEntity signerEntity) {
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

    public DocumentObserverResponseDto toObserverResponseDto(DocumentObserverEntity observerEntity) {
        return new DocumentObserverResponseDto(
            observerEntity.getId(),
            observerEntity.getDocumentId(),
            observerEntity.getObserverAccountId(),
            observerEntity.getRole(),
            observerEntity.getCreatedAt()
        );
    }

    public DocumentSignatureResponseDto toSignatureResponseDto(DocumentSignatureEntity signatureEntity) {
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

    public DocumentKeyEnvelopeResponseDto toKeyEnvelopeResponseDto(DocumentKeyEnvelopeEntity keyEnvelopeEntity) {
        return new DocumentKeyEnvelopeResponseDto(
            keyEnvelopeEntity.getId(),
            keyEnvelopeEntity.getDocumentId(),
            keyEnvelopeEntity.getTargetAccountId(),
            keyEnvelopeEntity.getTargetDeviceId(),
            keyEnvelopeEntity.getAlgorithm(),
            keyEnvelopeEntity.getEncryptedKeyBase64()
        );
    }
}

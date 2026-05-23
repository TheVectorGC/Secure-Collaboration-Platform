package dev.documentservice.repository;

import dev.documentservice.model.entity.DocumentSignatureEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentSignatureRepository extends JpaRepository<DocumentSignatureEntity, UUID> {
    boolean existsByDocumentIdAndSignerAccountId(UUID documentId, UUID signerAccountId);

    List<DocumentSignatureEntity> findByDocumentId(UUID documentId);

    List<DocumentSignatureEntity> findByDocumentIdIn(Collection<UUID> documentIds);
}

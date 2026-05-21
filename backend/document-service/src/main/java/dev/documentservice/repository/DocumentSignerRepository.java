package dev.documentservice.repository;

import dev.documentservice.model.entity.DocumentSignerEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentSignerRepository extends JpaRepository<DocumentSignerEntity, UUID> {
    Optional<DocumentSignerEntity> findByDocumentIdAndSignerAccountId(UUID documentId, UUID signerAccountId);

    List<DocumentSignerEntity> findByDocumentId(UUID documentId);

    List<DocumentSignerEntity> findByDocumentIdIn(Collection<UUID> documentIds);
}

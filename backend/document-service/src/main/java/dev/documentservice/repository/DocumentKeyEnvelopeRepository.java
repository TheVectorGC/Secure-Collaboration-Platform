package dev.documentservice.repository;

import dev.documentservice.model.entity.DocumentKeyEnvelopeEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentKeyEnvelopeRepository extends JpaRepository<DocumentKeyEnvelopeEntity, UUID> {
    List<DocumentKeyEnvelopeEntity> findByDocumentIdAndTargetAccountId(UUID documentId, UUID targetAccountId);

    List<DocumentKeyEnvelopeEntity> findByDocumentIdIn(Collection<UUID> documentIds);
}

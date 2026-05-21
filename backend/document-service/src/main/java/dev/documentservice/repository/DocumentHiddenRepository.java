package dev.documentservice.repository;

import dev.documentservice.model.entity.DocumentHiddenEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentHiddenRepository extends JpaRepository<DocumentHiddenEntity, UUID> {
    boolean existsByDocumentIdAndAccountId(UUID documentId, UUID accountId);

    Optional<DocumentHiddenEntity> findByDocumentIdAndAccountId(UUID documentId, UUID accountId);

    List<DocumentHiddenEntity> findByAccountIdAndDocumentIdIn(UUID accountId, Collection<UUID> documentIds);
}

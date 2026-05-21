package dev.documentservice.repository;

import dev.documentservice.model.entity.DocumentObserverEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentObserverRepository extends JpaRepository<DocumentObserverEntity, UUID> {
    Optional<DocumentObserverEntity> findByDocumentIdAndObserverAccountId(UUID documentId, UUID observerAccountId);

    boolean existsByDocumentIdAndObserverAccountId(UUID documentId, UUID observerAccountId);

    List<DocumentObserverEntity> findByDocumentId(UUID documentId);

    List<DocumentObserverEntity> findByDocumentIdIn(Collection<UUID> documentIds);

    List<DocumentObserverEntity> findByObserverAccountIdOrderByCreatedAtDesc(UUID observerAccountId);
}

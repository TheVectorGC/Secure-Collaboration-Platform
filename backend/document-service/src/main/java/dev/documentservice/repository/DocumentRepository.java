package dev.documentservice.repository;

import dev.documentservice.model.entity.DocumentEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentRepository extends JpaRepository<DocumentEntity, UUID> {
    List<DocumentEntity> findByChatIdOrderByCreatedAtDesc(UUID chatId);

    List<DocumentEntity> findByChatIdInOrderByCreatedAtDesc(Collection<UUID> chatIds);

    List<DocumentEntity> findByOwnerAccountIdOrderByCreatedAtDesc(UUID ownerAccountId);

    List<DocumentEntity> findByIdInOrderByCreatedAtDesc(Collection<UUID> documentIds);
}

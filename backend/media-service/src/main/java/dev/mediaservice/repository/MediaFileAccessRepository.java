package dev.mediaservice.repository;

import dev.mediaservice.model.entity.MediaFileAccessEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MediaFileAccessRepository extends JpaRepository<MediaFileAccessEntity, UUID> {
    boolean existsByMediaFileIdAndAccountId(UUID mediaFileId, UUID accountId);
}

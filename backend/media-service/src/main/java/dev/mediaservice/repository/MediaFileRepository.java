package dev.mediaservice.repository;

import dev.mediaservice.model.entity.MediaFileEntity;
import dev.mediaservice.model.enumeration.MediaFileStatus;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaFileRepository extends JpaRepository<MediaFileEntity, UUID> {
    Optional<MediaFileEntity> findByIdAndStatus(UUID id, MediaFileStatus status);
}

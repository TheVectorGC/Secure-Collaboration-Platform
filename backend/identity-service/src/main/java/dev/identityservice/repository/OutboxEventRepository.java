package dev.identityservice.repository;

import dev.identityservice.model.entity.OutboxEventEntity;
import dev.identityservice.model.enumeration.OutboxEventStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEventEntity, UUID> {
    List<OutboxEventEntity> findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(
            OutboxEventStatus status,
            OffsetDateTime nextAttemptAt
    );
}

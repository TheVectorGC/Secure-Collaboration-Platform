package dev.messagingservice.repository;

import dev.messagingservice.model.entity.OutboxEventEntity;
import dev.messagingservice.model.enumeration.OutboxEventStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEventEntity, UUID> {
    List<OutboxEventEntity> findTop100ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(
            OutboxEventStatus status,
            OffsetDateTime nextAttemptAt
    );
}

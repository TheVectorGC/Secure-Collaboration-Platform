package dev.identityservice.outbox;

import dev.identityservice.properties.OutboxProperties;
import dev.identityservice.model.entity.OutboxEventEntity;
import dev.identityservice.model.enumeration.OutboxEventStatus;
import dev.identityservice.repository.OutboxEventRepository;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "application.outbox", name = "enabled", havingValue = "true")
public class OutboxEventPublisher {
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final OutboxProperties outboxProperties;
    private final OutboxEventRepository outboxEventRepository;

    @Scheduled(fixedDelayString = "${application.outbox.publish-interval:PT5S}")
    @Transactional
    public void publishPendingEvents() {
        List<OutboxEventEntity> pendingEvents = outboxEventRepository
                .findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(OutboxEventStatus.PENDING, OffsetDateTime.now())
                .stream()
                .limit(outboxProperties.batchSize())
                .toList();

        if (pendingEvents.isEmpty()) {
            return;
        }

        pendingEvents.forEach(this::publishEvent);
    }

    private void publishEvent(OutboxEventEntity outboxEventEntity) {
        try {
            kafkaTemplate.send(outboxProperties.topic(), outboxEventEntity.getAggregateId(), outboxEventEntity.getPayload()).get();
            outboxEventEntity.setStatus(OutboxEventStatus.PUBLISHED);
            outboxEventEntity.setPublishedAt(OffsetDateTime.now());
            outboxEventEntity.setLastError(null);
            outboxEventRepository.save(outboxEventEntity);
            log.debug("Identity outbox event published. Event ID: {}, type: {}.", outboxEventEntity.getId(), outboxEventEntity.getEventType());
        }
        catch (Exception exception) {
            outboxEventEntity.setAttemptCount(outboxEventEntity.getAttemptCount() + 1);
            outboxEventEntity.setLastError(exception.getMessage());
            outboxEventEntity.setNextAttemptAt(OffsetDateTime.now().plusSeconds(calculateRetryDelaySeconds(outboxEventEntity.getAttemptCount())));
            outboxEventRepository.save(outboxEventEntity);
            log.warn("Identity outbox event publish failed. Event ID: {}, attempt: {}.", outboxEventEntity.getId(), outboxEventEntity.getAttemptCount());
        }
    }

    private long calculateRetryDelaySeconds(int attemptCount) {
        return Math.min(300, Math.max(5, attemptCount * 10L));
    }
}

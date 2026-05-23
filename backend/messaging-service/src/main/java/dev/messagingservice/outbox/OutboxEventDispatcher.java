package dev.messagingservice.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.messagingservice.properties.OutboxProperties;
import dev.messagingservice.model.entity.OutboxEventEntity;
import dev.messagingservice.model.enumeration.OutboxEventStatus;
import dev.messagingservice.model.event.MessagingEventDto;
import dev.messagingservice.repository.OutboxEventRepository;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class OutboxEventDispatcher {
    private final OutboxEventRepository outboxEventRepository;
    private final KafkaMessagingEventSender kafkaMessagingEventSender;
    private final ObjectMapper objectMapper;
    private final OutboxProperties outboxProperties;

    @Scheduled(fixedDelayString = "${application.outbox.dispatch-interval-ms:1000}")
    @Transactional
    public void dispatchPendingEvents() {
        if (!outboxProperties.enabled()) {
            return;
        }

        List<OutboxEventEntity> eventEntities = outboxEventRepository
                .findTop100ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(OutboxEventStatus.PENDING, OffsetDateTime.now())
                .stream()
                .limit(outboxProperties.batchSize())
                .toList();

        for (OutboxEventEntity eventEntity : eventEntities) {
            dispatchEvent(eventEntity);
        }
    }

    private void dispatchEvent(OutboxEventEntity eventEntity) {
        try {
            MessagingEventDto messagingEventDto = objectMapper.readValue(eventEntity.getPayloadJson(), MessagingEventDto.class);
            kafkaMessagingEventSender.send(eventEntity.getTopic(), eventEntity.getEventKey(), messagingEventDto);
            OffsetDateTime now = OffsetDateTime.now();
            eventEntity.setStatus(OutboxEventStatus.PUBLISHED);
            eventEntity.setPublishedAt(now);
            eventEntity.setUpdatedAt(now);
            eventEntity.setLastError(null);
            outboxEventRepository.save(eventEntity);
            log.info("Outbox event published. Outbox event ID: {}, event type: {}.", eventEntity.getId(), eventEntity.getEventType());
        }
        catch (Exception exception) {
            OffsetDateTime now = OffsetDateTime.now();
            int attempts = eventEntity.getAttempts() == null ? 1 : eventEntity.getAttempts() + 1;
            eventEntity.setAttempts(attempts);
            eventEntity.setUpdatedAt(now);
            eventEntity.setLastError(exception.getMessage());

            if (attempts >= outboxProperties.maxAttempts()) {
                eventEntity.setStatus(OutboxEventStatus.FAILED);
                log.error("Outbox event permanently failed. Outbox event ID: {}, attempts: {}.", eventEntity.getId(), attempts, exception);
            }
            else {
                eventEntity.setNextAttemptAt(now.plusSeconds(outboxProperties.retryDelaySeconds()));
                log.warn("Outbox event publish failed. Outbox event ID: {}, attempts: {}.", eventEntity.getId(), attempts);
            }

            outboxEventRepository.save(eventEntity);
        }
    }
}

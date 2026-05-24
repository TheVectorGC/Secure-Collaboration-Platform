package dev.identityservice.outbox;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.identityservice.observability.RequestIdFilter;
import dev.identityservice.properties.OutboxProperties;
import dev.identityservice.model.entity.OutboxEventEntity;
import dev.identityservice.model.enumeration.OutboxEventStatus;
import dev.identityservice.repository.OutboxEventRepository;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.apache.kafka.clients.producer.ProducerRecord;
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
    private final ObjectMapper objectMapper;

    @Scheduled(fixedDelayString = "${application.outbox.dispatch-interval:PT5S}")
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
            kafkaTemplate.send(createProducerRecord(outboxEventEntity)).get();
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


    private ProducerRecord<String, String> createProducerRecord(OutboxEventEntity outboxEventEntity) {
        ProducerRecord<String, String> producerRecord = new ProducerRecord<>(
                outboxProperties.topic(),
                outboxEventEntity.getAggregateId(),
                outboxEventEntity.getPayload()
        );
        String requestId = extractRequestId(outboxEventEntity.getPayload());

        if (requestId != null && !requestId.isBlank()) {
            producerRecord.headers().add(RequestIdFilter.REQUEST_ID_HEADER, requestId.getBytes(StandardCharsets.UTF_8));
        }

        return producerRecord;
    }

    private String extractRequestId(String payload) {
        try {
            JsonNode rootNode = objectMapper.readTree(payload);
            JsonNode requestIdNode = rootNode.get("requestId");
            return requestIdNode == null || requestIdNode.isNull() ? null : requestIdNode.asText();
        }
        catch (Exception exception) {
            return null;
        }
    }

    private long calculateRetryDelaySeconds(int attemptCount) {
        return Math.min(300, Math.max(5, attemptCount * 10L));
    }
}

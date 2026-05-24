package dev.documentservice.outbox.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.documentservice.observability.RequestIdProvider;
import dev.documentservice.properties.OutboxProperties;
import dev.documentservice.model.entity.OutboxEventEntity;
import dev.documentservice.model.enumeration.OutboxEventStatus;
import dev.documentservice.repository.OutboxEventRepository;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Slf4j
@Component
@RequiredArgsConstructor
public class KafkaOutboxEventDispatcher {
    private final OutboxEventRepository outboxEventRepository;
    private final OutboxProperties outboxProperties;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Scheduled(fixedDelayString = "${application.outbox.dispatch-interval:PT1S}")
    @Transactional
    public void dispatchPendingEvents() {
        if (!outboxProperties.enabled()) {
            return;
        }
        List<OutboxEventEntity> pendingEvents = outboxEventRepository.findTop100ByStatusOrderByCreatedAtAsc(OutboxEventStatus.PENDING)
            .stream()
            .limit(Math.max(1, outboxProperties.batchSize()))
            .toList();
        for (OutboxEventEntity pendingEvent : pendingEvents) {
            dispatchEvent(pendingEvent);
        }
    }

    private void dispatchEvent(OutboxEventEntity outboxEventEntity) {
        try {
            kafkaTemplate.send(createProducerRecord(outboxEventEntity)).get();
            OffsetDateTime now = OffsetDateTime.now();
            outboxEventEntity.setStatus(OutboxEventStatus.PUBLISHED);
            outboxEventEntity.setPublishedAt(now);
            outboxEventEntity.setUpdatedAt(now);
            outboxEventEntity.setLastError(null);
            outboxEventRepository.save(outboxEventEntity);
            log.debug("Document outbox event published. eventId={} eventType={}", outboxEventEntity.getId(), outboxEventEntity.getEventType());
        }
        catch (Exception exception) {
            OffsetDateTime now = OffsetDateTime.now();
            int nextAttempt = outboxEventEntity.getAttempts() + 1;
            outboxEventEntity.setAttempts(nextAttempt);
            outboxEventEntity.setUpdatedAt(now);
            outboxEventEntity.setLastError(truncate(exception.getMessage()));
            if (nextAttempt >= outboxProperties.maxAttempts()) {
                outboxEventEntity.setStatus(OutboxEventStatus.FAILED);
            }
            outboxEventRepository.save(outboxEventEntity);
            log.warn("Document outbox event dispatch failed. eventId={} attempt={} status={}", outboxEventEntity.getId(), nextAttempt, outboxEventEntity.getStatus(), exception);
        }
    }


    private ProducerRecord<String, String> createProducerRecord(OutboxEventEntity outboxEventEntity) {
        ProducerRecord<String, String> producerRecord = new ProducerRecord<>(
            outboxEventEntity.getTopic(),
            outboxEventEntity.getEventKey(),
            outboxEventEntity.getPayload()
        );
        String requestId = extractRequestId(outboxEventEntity.getPayload());

        if (requestId != null && !requestId.isBlank()) {
            producerRecord.headers().add(RequestIdProvider.HEADER_NAME, requestId.getBytes(StandardCharsets.UTF_8));
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

    private String truncate(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.length() <= 2000 ? value : value.substring(0, 2000);
    }
}

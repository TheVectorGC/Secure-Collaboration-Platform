package dev.documentservice.outbox.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.documentservice.properties.DocumentKafkaProperties;
import dev.documentservice.exception.DocumentValidationException;
import dev.documentservice.model.entity.OutboxEventEntity;
import dev.documentservice.model.enumeration.OutboxEventStatus;
import dev.documentservice.model.event.DocumentEventDto;
import dev.documentservice.outbox.DocumentEventPublisher;
import dev.documentservice.repository.OutboxEventRepository;
import java.time.OffsetDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class OutboxDocumentEventPublisher implements DocumentEventPublisher {
    private final OutboxEventRepository outboxEventRepository;
    private final DocumentKafkaProperties documentKafkaProperties;
    private final ObjectMapper objectMapper;

    @Override
    public void publish(DocumentEventDto documentEventDto) {
        try {
            OffsetDateTime now = OffsetDateTime.now();
            String payload = objectMapper.writeValueAsString(documentEventDto);
            OutboxEventEntity outboxEventEntity = OutboxEventEntity.builder()
                .id(documentEventDto.eventId())
                .topic(documentKafkaProperties.documentEvents())
                .eventKey(documentEventDto.eventId().toString())
                .eventType(documentEventDto.eventType().name())
                .payload(payload)
                .status(OutboxEventStatus.PENDING)
                .attempts(0)
                .createdAt(now)
                .updatedAt(now)
                .build();
            outboxEventRepository.save(outboxEventEntity);
            log.debug("Document outbox event stored. eventId={} eventType={} documentId={}", documentEventDto.eventId(), documentEventDto.eventType(), documentEventDto.payload().get("documentId"));
        }
        catch (Exception exception) {
            throw new DocumentValidationException("Failed to store document event in outbox.", exception);
        }
    }
}

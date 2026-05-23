package dev.messagingservice.outbox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.messagingservice.properties.KafkaTopicsProperties;
import dev.messagingservice.model.entity.OutboxEventEntity;
import dev.messagingservice.model.enumeration.OutboxEventStatus;
import dev.messagingservice.model.event.MessagingEventDto;
import dev.messagingservice.repository.OutboxEventRepository;
import dev.messagingservice.service.MessagingEventPublisher;
import java.time.OffsetDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class OutboxMessagingEventPublisher implements MessagingEventPublisher {
    private final OutboxEventRepository outboxEventRepository;
    private final KafkaTopicsProperties kafkaTopicsProperties;
    private final ObjectMapper objectMapper;

    @Override
    public void publish(MessagingEventDto messagingEventDto) {
        OffsetDateTime now = OffsetDateTime.now();
        String payloadJson = serialize(messagingEventDto);
        OutboxEventEntity outboxEventEntity = OutboxEventEntity.builder()
                .topic(kafkaTopicsProperties.messagingEvents())
                .eventKey(messagingEventDto.chatId().toString())
                .eventType(messagingEventDto.eventType().name())
                .payloadJson(payloadJson)
                .status(OutboxEventStatus.PENDING)
                .attempts(0)
                .nextAttemptAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
        OutboxEventEntity savedOutboxEventEntity = outboxEventRepository.save(outboxEventEntity);
        log.debug(
                "Messaging event stored in outbox. Outbox event ID: {}, event ID: {}, type: {}.",
                savedOutboxEventEntity.getId(),
                messagingEventDto.eventId(),
                messagingEventDto.eventType()
        );
    }

    private String serialize(MessagingEventDto messagingEventDto) {
        try {
            return objectMapper.writeValueAsString(messagingEventDto);
        }
        catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize messaging event.", exception);
        }
    }
}

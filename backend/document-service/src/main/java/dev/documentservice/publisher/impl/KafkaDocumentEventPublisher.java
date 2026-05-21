package dev.documentservice.publisher.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.documentservice.model.event.DocumentEventDto;
import dev.documentservice.publisher.DocumentEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class KafkaDocumentEventPublisher implements DocumentEventPublisher {
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${application.kafka.topics.document-events:document.events}")
    private String documentEventsTopic;

    @Override
    public void publish(DocumentEventDto documentEventDto) {
        try {
            String serializedEvent = objectMapper.writeValueAsString(documentEventDto);
            kafkaTemplate.send(documentEventsTopic, documentEventDto.eventId().toString(), serializedEvent);
        }
        catch (Exception exception) {
            log.warn("Failed to publish document event. Event ID: {}.", documentEventDto.eventId(), exception);
        }
    }
}

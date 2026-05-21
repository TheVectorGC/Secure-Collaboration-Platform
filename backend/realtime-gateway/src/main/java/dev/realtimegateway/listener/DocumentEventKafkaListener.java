package dev.realtimegateway.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.realtimegateway.model.event.MessagingEventDto;
import dev.realtimegateway.service.RealtimeDeliveryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DocumentEventKafkaListener {
    private final RealtimeDeliveryService realtimeDeliveryService;
    private final ObjectMapper objectMapper;

    @KafkaListener(
        topics = "${application.kafka.topics.document-events}",
        groupId = "${spring.kafka.consumer.group-id}"
    )
    public void handleDocumentEvent(String serializedDocumentEvent) {
        try {
            MessagingEventDto messagingEventDto = objectMapper.readValue(serializedDocumentEvent, MessagingEventDto.class);
            realtimeDeliveryService.deliverMessagingEvent(messagingEventDto);
        }
        catch (Exception exception) {
            log.warn("Failed to handle document event: {}.", serializedDocumentEvent, exception);
        }
    }
}

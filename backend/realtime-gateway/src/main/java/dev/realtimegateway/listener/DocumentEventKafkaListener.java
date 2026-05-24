package dev.realtimegateway.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.realtimegateway.model.event.RealtimeDomainEventDto;
import dev.realtimegateway.service.RealtimeDeliveryService;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DocumentEventKafkaListener {
    private static final String REQUEST_ID_MDC_KEY = "requestId";
    private final RealtimeDeliveryService realtimeDeliveryService;
    private final ObjectMapper objectMapper;

    @KafkaListener(
            topics = "${application.kafka.topics.document-events}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void handleDocumentEvent(String serializedDocumentEvent) {
        try {
            RealtimeDomainEventDto realtimeDomainEventDto = objectMapper.readValue(serializedDocumentEvent, RealtimeDomainEventDto.class);
            putRequestId(realtimeDomainEventDto);
            log.info(
                    "Document event received. eventId={}, eventType={}.",
                    realtimeDomainEventDto.eventId(),
                    realtimeDomainEventDto.eventType()
            );
            realtimeDeliveryService.deliverMessagingEvent(realtimeDomainEventDto);
        }
        catch (Exception exception) {
            log.warn("Failed to handle document event.", exception);
            log.debug("Invalid document event payload: {}.", serializedDocumentEvent);
        }
        finally {
            MDC.remove(REQUEST_ID_MDC_KEY);
        }
    }

    private void putRequestId(RealtimeDomainEventDto realtimeDomainEventDto) {
        if (realtimeDomainEventDto.requestId() != null && !realtimeDomainEventDto.requestId().isBlank()) {
            MDC.put(REQUEST_ID_MDC_KEY, realtimeDomainEventDto.requestId());
        }
    }
}

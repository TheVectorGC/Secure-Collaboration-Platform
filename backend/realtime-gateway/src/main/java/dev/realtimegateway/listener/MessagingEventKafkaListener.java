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
public class MessagingEventKafkaListener {
    private final RealtimeDeliveryService realtimeDeliveryService;
    private final ObjectMapper objectMapper;

    @KafkaListener(
            topics = "${application.kafka.topics.messaging-events}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void handleMessagingEvent(String serializedMessagingEvent) {
        try {
            MessagingEventDto messagingEventDto = objectMapper.readValue(
                    serializedMessagingEvent,
                    MessagingEventDto.class
            );

            log.info(
                    "Received messaging event. Type: {}, event ID: {}, chat ID: {}.",
                    messagingEventDto.eventType(),
                    messagingEventDto.eventId(),
                    messagingEventDto.chatId()
            );

            realtimeDeliveryService.deliverMessagingEvent(messagingEventDto);
        }
        catch (Exception exception) {
            log.warn("Failed to handle messaging event: {}.", serializedMessagingEvent, exception);
        }
    }
}
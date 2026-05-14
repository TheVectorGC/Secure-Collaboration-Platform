package dev.realtimegateway.listener;

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

    @KafkaListener(
        topics = "#{@kafkaTopicsProperties.messagingEvents()}",
        groupId = "${spring.kafka.consumer.group-id}"
    )
    public void handleMessagingEvent(MessagingEventDto messagingEventDto) {
        log.info(
            "Received messaging event. Type: {}, event ID: {}, chat ID: {}.",
            messagingEventDto.eventType(),
            messagingEventDto.eventId(),
            messagingEventDto.chatId()
        );
        realtimeDeliveryService.deliverMessagingEvent(messagingEventDto);
    }
}

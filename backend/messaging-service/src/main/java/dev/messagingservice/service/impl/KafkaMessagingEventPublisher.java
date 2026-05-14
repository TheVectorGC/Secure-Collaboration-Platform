package dev.messagingservice.service.impl;

import dev.messagingservice.config.properties.KafkaTopicsProperties;
import dev.messagingservice.model.event.MessagingEventDto;
import dev.messagingservice.service.MessagingEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class KafkaMessagingEventPublisher implements MessagingEventPublisher {
    private final KafkaTemplate<String, MessagingEventDto> kafkaTemplate;
    private final KafkaTopicsProperties kafkaTopicsProperties;

    @Override
    public void publish(MessagingEventDto messagingEventDto) {
        String key = messagingEventDto.chatId().toString();

        kafkaTemplate.send(kafkaTopicsProperties.messagingEvents(), key, messagingEventDto)
            .whenComplete((sendResult, throwable) -> {
                if (throwable != null) {
                    log.warn(
                        "Failed to publish messaging event. Event ID: {}, type: {}.",
                        messagingEventDto.eventId(),
                        messagingEventDto.eventType(),
                        throwable
                    );
                    return;
                }

                log.info(
                    "Messaging event published. Event ID: {}, type: {}, topic: {}.",
                    messagingEventDto.eventId(),
                    messagingEventDto.eventType(),
                    kafkaTopicsProperties.messagingEvents()
                );
            });
    }
}

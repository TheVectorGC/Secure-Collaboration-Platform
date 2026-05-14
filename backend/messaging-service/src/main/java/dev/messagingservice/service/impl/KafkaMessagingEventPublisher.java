package dev.messagingservice.service.impl;

import dev.messagingservice.config.properties.KafkaTopicsProperties;
import dev.messagingservice.model.event.MessagingEventDto;
import dev.messagingservice.service.MessagingEventPublisher;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class KafkaMessagingEventPublisher implements MessagingEventPublisher {
    private static final long SEND_TIMEOUT_SECONDS = 5L;

    private final KafkaTemplate<String, MessagingEventDto> kafkaTemplate;
    private final KafkaTopicsProperties kafkaTopicsProperties;

    @Override
    public void publish(MessagingEventDto messagingEventDto) {
        String topic = kafkaTopicsProperties.messagingEvents();
        String key = messagingEventDto.chatId().toString();

        log.info(
                "Trying to publish messaging event. Event ID: {}, type: {}, topic: {}, key: {}.",
                messagingEventDto.eventId(),
                messagingEventDto.eventType(),
                topic,
                key
        );

        try {
            SendResult<String, MessagingEventDto> sendResult = kafkaTemplate
                    .send(topic, key, messagingEventDto)
                    .get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            log.info(
                    "Messaging event published. Event ID: {}, type: {}, topic: {}, partition: {}, offset: {}.",
                    messagingEventDto.eventId(),
                    messagingEventDto.eventType(),
                    sendResult.getRecordMetadata().topic(),
                    sendResult.getRecordMetadata().partition(),
                    sendResult.getRecordMetadata().offset()
            );
        }
        catch (TimeoutException exception) {
            log.error(
                    "Kafka publish timeout. Event ID: {}, type: {}, topic: {}.",
                    messagingEventDto.eventId(),
                    messagingEventDto.eventType(),
                    topic,
                    exception
            );
        }
        catch (Exception exception) {
            log.error(
                    "Failed to publish messaging event. Event ID: {}, type: {}, topic: {}.",
                    messagingEventDto.eventId(),
                    messagingEventDto.eventType(),
                    topic,
                    exception
            );
        }
    }
}
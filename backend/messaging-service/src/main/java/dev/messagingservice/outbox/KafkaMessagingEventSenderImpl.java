package dev.messagingservice.outbox;

import dev.messagingservice.model.event.MessagingEventDto;
import dev.messagingservice.observability.RequestIdProvider;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class KafkaMessagingEventSenderImpl implements KafkaMessagingEventSender {
    private static final long SEND_TIMEOUT_SECONDS = 5L;

    private final KafkaTemplate<String, MessagingEventDto> kafkaTemplate;

    @Override
    public void send(String topic, String key, MessagingEventDto messagingEventDto) {
        try {
            SendResult<String, MessagingEventDto> sendResult = kafkaTemplate
                    .send(createProducerRecord(topic, key, messagingEventDto))
                    .get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            log.debug(
                    "Messaging event sent to Kafka. Event ID: {}, type: {}, topic: {}, partition: {}, offset: {}.",
                    messagingEventDto.eventId(),
                    messagingEventDto.eventType(),
                    sendResult.getRecordMetadata().topic(),
                    sendResult.getRecordMetadata().partition(),
                    sendResult.getRecordMetadata().offset()
            );
        }
        catch (TimeoutException exception) {
            throw new IllegalStateException("Kafka publish timeout.", exception);
        }
        catch (Exception exception) {
            throw new IllegalStateException("Kafka publish failed.", exception);
        }
    }

    private ProducerRecord<String, MessagingEventDto> createProducerRecord(String topic, String key, MessagingEventDto messagingEventDto) {
        ProducerRecord<String, MessagingEventDto> producerRecord = new ProducerRecord<>(topic, key, messagingEventDto);

        if (messagingEventDto.requestId() != null && !messagingEventDto.requestId().isBlank()) {
            producerRecord.headers().add(RequestIdProvider.REQUEST_ID_HEADER, messagingEventDto.requestId().getBytes(StandardCharsets.UTF_8));
        }

        return producerRecord;
    }

}

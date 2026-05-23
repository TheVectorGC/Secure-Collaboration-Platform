package dev.messagingservice.outbox;

import dev.messagingservice.model.event.MessagingEventDto;

public interface KafkaMessagingEventSender {
    void send(String topic, String key, MessagingEventDto messagingEventDto);
}

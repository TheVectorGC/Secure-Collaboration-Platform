package dev.messagingservice.service;

import dev.messagingservice.model.event.MessagingEventDto;

public interface MessagingEventPublisher {
    void publish(MessagingEventDto messagingEventDto);
}

package dev.realtimegateway.service;

import dev.realtimegateway.model.event.MessagingEventDto;

public interface RealtimeDeliveryService {
    void deliverMessagingEvent(MessagingEventDto messagingEventDto);
}

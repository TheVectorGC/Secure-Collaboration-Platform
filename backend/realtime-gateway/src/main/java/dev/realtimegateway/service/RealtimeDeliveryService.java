package dev.realtimegateway.service;

import dev.realtimegateway.model.event.RealtimeDomainEventDto;

public interface RealtimeDeliveryService {
    void deliverMessagingEvent(RealtimeDomainEventDto realtimeDomainEventDto);
}

package dev.realtimegateway.service.impl;

import dev.realtimegateway.model.dto.RealtimeEnvelopeDto;
import dev.realtimegateway.model.event.MessagingEventDto;
import dev.realtimegateway.service.RealtimeDeliveryService;
import dev.realtimegateway.session.ConnectionRegistry;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RealtimeDeliveryServiceImpl implements RealtimeDeliveryService {
    private final ConnectionRegistry connectionRegistry;

    @Override
    public void deliverMessagingEvent(MessagingEventDto messagingEventDto) {
        RealtimeEnvelopeDto realtimeEnvelopeDto = new RealtimeEnvelopeDto(
            messagingEventDto.eventId(),
            messagingEventDto.eventType(),
            messagingEventDto.occurredAt(),
            messagingEventDto.payload()
        );

        messagingEventDto.recipientAccountIds().stream()
            .filter(accountId -> accountId != null)
            .forEach(accountId -> deliverToAccount(accountId, realtimeEnvelopeDto));
    }

    private void deliverToAccount(UUID accountId, RealtimeEnvelopeDto realtimeEnvelopeDto) {
        connectionRegistry.sendToAccount(accountId, realtimeEnvelopeDto);
    }
}

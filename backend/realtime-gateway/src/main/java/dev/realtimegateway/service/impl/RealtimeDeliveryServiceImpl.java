package dev.realtimegateway.service.impl;

import dev.realtimegateway.model.dto.RealtimeEnvelopeDto;
import dev.realtimegateway.model.event.MessagingEventDto;
import dev.realtimegateway.service.RealtimeDeliveryService;
import dev.realtimegateway.session.ConnectionRegistry;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class RealtimeDeliveryServiceImpl implements RealtimeDeliveryService {
    private final ConnectionRegistry connectionRegistry;

    @Override
    public void deliverMessagingEvent(MessagingEventDto messagingEventDto) {
        if (messagingEventDto.recipientAccountIds() == null || messagingEventDto.recipientAccountIds().isEmpty()) {
            log.debug("Realtime event has no recipients. eventId={}, eventType={}.", messagingEventDto.eventId(), messagingEventDto.eventType());
            return;
        }

        RealtimeEnvelopeDto realtimeEnvelopeDto = new RealtimeEnvelopeDto(
                messagingEventDto.eventId(),
                messagingEventDto.eventType(),
                messagingEventDto.occurredAt(),
                messagingEventDto.payload()
        );
        List<UUID> recipientAccountIds = messagingEventDto.recipientAccountIds().stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        connectionRegistry.sendToAccounts(recipientAccountIds, realtimeEnvelopeDto);
        log.debug(
                "Realtime event delivered to connected sessions. eventId={}, eventType={}, recipientCount={}.",
                messagingEventDto.eventId(),
                messagingEventDto.eventType(),
                recipientAccountIds.size()
        );
    }
}

package dev.realtimegateway.service.impl;

import dev.realtimegateway.model.dto.RealtimeEnvelopeDto;
import dev.realtimegateway.model.event.RealtimeDomainEventDto;
import dev.realtimegateway.model.enumeration.RealtimeEventType;
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
    public void deliverMessagingEvent(RealtimeDomainEventDto realtimeDomainEventDto) {
        if (realtimeDomainEventDto.recipientAccountIds() == null || realtimeDomainEventDto.recipientAccountIds().isEmpty()) {
            log.debug("Realtime event has no recipients. eventId={}, eventType={}.", realtimeDomainEventDto.eventId(), realtimeDomainEventDto.eventType());
            return;
        }

        RealtimeEventType realtimeEventType = RealtimeEventType.valueOf(realtimeDomainEventDto.eventType());
        RealtimeEnvelopeDto realtimeEnvelopeDto = new RealtimeEnvelopeDto(
                realtimeDomainEventDto.eventId(),
                realtimeEventType,
                realtimeDomainEventDto.occurredAt(),
                realtimeDomainEventDto.payload()
        );
        List<UUID> recipientAccountIds = realtimeDomainEventDto.recipientAccountIds().stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        connectionRegistry.sendToAccounts(recipientAccountIds, realtimeEnvelopeDto);
        log.debug(
                "Realtime event delivered to connected sessions. eventId={}, eventType={}, recipientCount={}.",
                realtimeDomainEventDto.eventId(),
                realtimeDomainEventDto.eventType(),
                recipientAccountIds.size()
        );
    }
}

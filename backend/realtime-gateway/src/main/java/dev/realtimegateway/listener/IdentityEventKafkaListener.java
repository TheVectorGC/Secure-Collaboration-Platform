package dev.realtimegateway.listener;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.realtimegateway.model.dto.RealtimeEnvelopeDto;
import dev.realtimegateway.model.dto.identity.IdentityEventDto;
import dev.realtimegateway.model.enumeration.RealtimeEventType;
import dev.realtimegateway.model.dto.internal.ProfileUpdateRecipientsResponseDto;
import dev.realtimegateway.properties.InternalApiProperties;
import dev.realtimegateway.properties.MessagingServiceProperties;
import dev.realtimegateway.session.ConnectionRegistry;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Slf4j
@Component
@RequiredArgsConstructor
public class IdentityEventKafkaListener {
    private static final String REQUEST_ID_MDC_KEY = "requestId";
    private static final String PROFILE_UPDATED_EVENT = "PROFILE_UPDATED";
    private static final String DEVICE_REVOKED_EVENT = "DEVICE_REVOKED";
    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";

    private final ObjectMapper objectMapper;
    private final RestClient messagingServiceRestClient;
    private final MessagingServiceProperties messagingServiceProperties;
    private final InternalApiProperties internalApiProperties;
    private final ConnectionRegistry connectionRegistry;

    @KafkaListener(
            topics = "${application.kafka.topics.identity-events}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void handleIdentityEvent(String serializedIdentityEvent) {
        try {
            IdentityEventDto identityEventDto = objectMapper.readValue(serializedIdentityEvent, IdentityEventDto.class);
            putRequestId(identityEventDto);

            if (DEVICE_REVOKED_EVENT.equals(identityEventDto.eventType())) {
                deliverDeviceRevokedEvent(identityEventDto);
                return;
            }

            if (!PROFILE_UPDATED_EVENT.equals(identityEventDto.eventType())) {
                return;
            }

            JsonNode profileNode = identityEventDto.payload() == null ? null : identityEventDto.payload().get("profile");
            UUID accountId = extractProfileAccountId(profileNode);

            if (accountId == null) {
                log.warn("Profile update event ignored because accountId is missing. eventId={}.", identityEventDto.eventId());
                return;
            }

            List<UUID> recipientAccountIds = loadRecipientAccountIds(accountId);

            if (recipientAccountIds.isEmpty()) {
                log.debug("Profile update event has no recipients. eventId={}, accountId={}.", identityEventDto.eventId(), accountId);
                return;
            }

            RealtimeEnvelopeDto realtimeEnvelopeDto = new RealtimeEnvelopeDto(
                    identityEventDto.eventId(),
                    RealtimeEventType.PROFILE_UPDATED,
                    identityEventDto.occurredAt() == null ? OffsetDateTime.now() : identityEventDto.occurredAt(),
                    profileNode
            );
            connectionRegistry.sendToAccounts(recipientAccountIds, realtimeEnvelopeDto);
            log.info(
                    "Profile update event delivered. eventId={}, accountId={}, recipientCount={}." ,
                    identityEventDto.eventId(),
                    accountId,
                    recipientAccountIds.size()
            );
        }
        catch (Exception exception) {
            log.warn("Failed to handle identity event.", exception);
            log.debug("Invalid identity event payload: {}.", serializedIdentityEvent);
        }
        finally {
            MDC.remove(REQUEST_ID_MDC_KEY);
        }
    }


    private void deliverDeviceRevokedEvent(IdentityEventDto identityEventDto) {
        JsonNode payloadNode = identityEventDto.payload();

        if (payloadNode == null || payloadNode.get("accountId") == null || payloadNode.get("deviceId") == null) {
            log.warn("Device revoked event ignored because payload is incomplete. eventId={}.", identityEventDto.eventId());
            return;
        }

        UUID accountId;

        try {
            accountId = UUID.fromString(payloadNode.get("accountId").asText());
        }
        catch (IllegalArgumentException exception) {
            log.warn("Device revoked event ignored because accountId is invalid. eventId={}.", identityEventDto.eventId());
            return;
        }

        RealtimeEnvelopeDto realtimeEnvelopeDto = new RealtimeEnvelopeDto(
                identityEventDto.eventId(),
                RealtimeEventType.DEVICE_REVOKED,
                identityEventDto.occurredAt() == null ? OffsetDateTime.now() : identityEventDto.occurredAt(),
                payloadNode
        );
        connectionRegistry.sendToAccounts(List.of(accountId), realtimeEnvelopeDto);
        log.info("Device revoked event delivered. eventId={}, accountId={}", identityEventDto.eventId(), accountId);
    }

    private UUID extractProfileAccountId(JsonNode profileNode) {
        if (profileNode == null || profileNode.get("accountId") == null || !profileNode.get("accountId").isTextual()) {
            return null;
        }

        try {
            return UUID.fromString(profileNode.get("accountId").asText());
        }
        catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private List<UUID> loadRecipientAccountIds(UUID accountId) {
        try {
            ProfileUpdateRecipientsResponseDto responseDto = messagingServiceRestClient.get()
                    .uri("/internal/profile-updates/{accountId}/recipients", accountId)
                    .header(INTERNAL_TOKEN_HEADER, internalApiProperties.token())
                    .retrieve()
                    .body(ProfileUpdateRecipientsResponseDto.class);

            if (responseDto == null || responseDto.recipientAccountIds() == null) {
                return List.of();
            }

            return responseDto.recipientAccountIds().stream()
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
        }
        catch (RestClientException exception) {
            log.warn("Failed to load profile update recipients. accountId={}.", accountId, exception);
            return List.of(accountId);
        }
    }

    private void putRequestId(IdentityEventDto identityEventDto) {
        if (identityEventDto.requestId() != null && !identityEventDto.requestId().isBlank()) {
            MDC.put(REQUEST_ID_MDC_KEY, identityEventDto.requestId());
        }
    }
}

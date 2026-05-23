package dev.identityservice.outbox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.identityservice.model.entity.OutboxEventEntity;
import dev.identityservice.model.enumeration.OutboxEventStatus;
import dev.identityservice.repository.OutboxEventRepository;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class IdentityOutboxServiceImpl implements IdentityOutboxService {
    private static final String ACCOUNT_AGGREGATE = "ACCOUNT";
    private static final String DEVICE_AGGREGATE = "DEVICE";
    private static final String ACCOUNT_BLOCKED_EVENT = "identity.account.blocked";
    private static final String ACCOUNT_UNBLOCKED_EVENT = "identity.account.unblocked";
    private static final String DEVICE_REVOKED_EVENT = "identity.device.revoked";

    private final ObjectMapper objectMapper;
    private final OutboxEventRepository outboxEventRepository;

    @Override
    public void enqueueAccountBlocked(UUID blockerAccountId, UUID blockedAccountId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("blockerAccountId", blockerAccountId);
        payload.put("blockedAccountId", blockedAccountId);
        saveOutboxEvent(ACCOUNT_AGGREGATE, blockerAccountId.toString(), ACCOUNT_BLOCKED_EVENT, payload);
    }

    @Override
    public void enqueueAccountUnblocked(UUID blockerAccountId, UUID blockedAccountId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("blockerAccountId", blockerAccountId);
        payload.put("blockedAccountId", blockedAccountId);
        saveOutboxEvent(ACCOUNT_AGGREGATE, blockerAccountId.toString(), ACCOUNT_UNBLOCKED_EVENT, payload);
    }

    @Override
    public void enqueueDeviceRevoked(UUID accountId, UUID deviceId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("accountId", accountId);
        payload.put("deviceId", deviceId);
        saveOutboxEvent(DEVICE_AGGREGATE, deviceId.toString(), DEVICE_REVOKED_EVENT, payload);
    }

    private void saveOutboxEvent(
            String aggregateType,
            String aggregateId,
            String eventType,
            Map<String, Object> payload
    ) {
        OffsetDateTime now = OffsetDateTime.now();
        OutboxEventEntity outboxEventEntity = OutboxEventEntity.builder()
                .aggregateType(aggregateType)
                .aggregateId(aggregateId)
                .eventType(eventType)
                .payload(writePayload(payload))
                .status(OutboxEventStatus.PENDING)
                .attemptCount(0)
                .nextAttemptAt(now)
                .createdAt(now)
                .build();

        outboxEventRepository.save(outboxEventEntity);
    }

    private String writePayload(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        }
        catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize identity outbox event payload.", exception);
        }
    }
}

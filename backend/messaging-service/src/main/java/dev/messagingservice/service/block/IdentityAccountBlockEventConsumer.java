package dev.messagingservice.service.block;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.Locale;
import org.slf4j.MDC;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class IdentityAccountBlockEventConsumer {
    private final ObjectMapper objectMapper;
    private final AccountBlockService accountBlockService;
    private final AccountBlockChatUpdatePublisher accountBlockChatUpdatePublisher;

    @KafkaListener(topics = "${application.kafka.topics.identity-events}", groupId = "${spring.kafka.consumer.group-id}")
    public void consumeIdentityEvent(String eventJson) {
        try {
            JsonNode rootNode = objectMapper.readTree(eventJson);
            String requestId = readText(rootNode, "requestId");
            if (requestId != null && !requestId.isBlank()) {
                MDC.put("requestId", requestId);
            }

            String eventType = readText(rootNode, "eventType", "type");

            if (eventType == null) {
                return;
            }

            String normalizedEventType = eventType.trim().toUpperCase(Locale.ROOT).replace('.', '_').replace('-', '_');

            if (!"ACCOUNT_BLOCKED".equals(normalizedEventType) && !"ACCOUNT_UNBLOCKED".equals(normalizedEventType)) {
                return;
            }

            JsonNode payloadNode = rootNode.has("payload") ? rootNode.get("payload") : rootNode;
            UUID blockerAccountId = readUuid(payloadNode, "blockerAccountId", "sourceAccountId", "accountId");
            UUID blockedAccountId = readUuid(payloadNode, "blockedAccountId", "targetAccountId");
            OffsetDateTime occurredAt = readOccurredAt(rootNode);

            if (blockerAccountId == null || blockedAccountId == null) {
                log.warn("Identity account block event skipped because required account IDs are missing. Event type: {}.", eventType);
                return;
            }

            if ("ACCOUNT_BLOCKED".equals(normalizedEventType)) {
                accountBlockService.applyAccountBlocked(blockerAccountId, blockedAccountId, occurredAt);
                accountBlockChatUpdatePublisher.publishDirectChatUpdate(blockerAccountId, blockedAccountId);
                return;
            }

            accountBlockService.applyAccountUnblocked(blockerAccountId, blockedAccountId);
            accountBlockChatUpdatePublisher.publishDirectChatUpdate(blockerAccountId, blockedAccountId);
        }
        catch (Exception exception) {
            log.warn("Identity account block event could not be processed: {}.", exception.getMessage());
        }
        finally {
            MDC.remove("requestId");
        }
    }

    private String readText(JsonNode node, String... fieldNames) {
        for (String fieldName : fieldNames) {
            if (node.hasNonNull(fieldName)) {
                return node.get(fieldName).asText();
            }
        }

        return null;
    }

    private UUID readUuid(JsonNode node, String... fieldNames) {
        String value = readText(node, fieldNames);

        if (value == null || value.isBlank()) {
            return null;
        }

        return UUID.fromString(value);
    }

    private OffsetDateTime readOccurredAt(JsonNode rootNode) {
        String occurredAt = readText(rootNode, "occurredAt", "createdAt", "timestamp");

        if (occurredAt == null || occurredAt.isBlank()) {
            return OffsetDateTime.now();
        }

        return OffsetDateTime.parse(occurredAt);
    }
}

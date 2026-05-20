package dev.realtimegateway.session;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.realtimegateway.model.dto.RealtimeEnvelopeDto;
import dev.realtimegateway.security.AccountPrincipal;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Slf4j
@Component
@RequiredArgsConstructor
public class ConnectionRegistry {
    private static final String ACCOUNT_PRINCIPAL_ATTRIBUTE = "accountPrincipal";

    private final ObjectMapper objectMapper;
    private final Map<UUID, Set<WebSocketSession>> sessionsByAccountId = new ConcurrentHashMap<>();
    private final Map<UUID, OffsetDateTime> lastSeenAtByAccountId = new ConcurrentHashMap<>();

    public boolean register(WebSocketSession webSocketSession, AccountPrincipal accountPrincipal) {
        webSocketSession.getAttributes().put(ACCOUNT_PRINCIPAL_ATTRIBUTE, accountPrincipal);
        Set<WebSocketSession> sessions = sessionsByAccountId.computeIfAbsent(
                accountPrincipal.accountId(),
                ignoredAccountId -> ConcurrentHashMap.newKeySet()
        );
        boolean wasOffline = sessions.stream().noneMatch(WebSocketSession::isOpen);
        sessions.add(webSocketSession);
        lastSeenAtByAccountId.remove(accountPrincipal.accountId());
        log.info("WebSocket session registered. Session ID: {}, account ID: {}.", webSocketSession.getId(), accountPrincipal.accountId());
        return wasOffline;
    }

    public boolean unregister(WebSocketSession webSocketSession) {
        AccountPrincipal accountPrincipal = getAccountPrincipal(webSocketSession);

        if (accountPrincipal == null) {
            return false;
        }

        Set<WebSocketSession> sessions = sessionsByAccountId.get(accountPrincipal.accountId());

        if (sessions != null) {
            sessions.remove(webSocketSession);
            sessions.removeIf(session -> !session.isOpen());

            if (sessions.isEmpty()) {
                sessionsByAccountId.remove(accountPrincipal.accountId());
                lastSeenAtByAccountId.put(accountPrincipal.accountId(), OffsetDateTime.now());
                log.info("WebSocket account went offline. Account ID: {}.", accountPrincipal.accountId());
                return true;
            }
        }

        log.info("WebSocket session unregistered. Session ID: {}, account ID: {}.", webSocketSession.getId(), accountPrincipal.accountId());
        return false;
    }

    public void sendToAccount(UUID accountId, RealtimeEnvelopeDto realtimeEnvelopeDto) {
        Set<WebSocketSession> sessions = sessionsByAccountId.get(accountId);

        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        String serializedEvent = serializeEvent(realtimeEnvelopeDto);
        sessions.stream()
                .filter(WebSocketSession::isOpen)
                .forEach(webSocketSession -> send(webSocketSession, serializedEvent));
    }

    public void sendToAccounts(Collection<UUID> accountIds, RealtimeEnvelopeDto realtimeEnvelopeDto) {
        accountIds.stream()
                .filter(accountId -> accountId != null)
                .distinct()
                .forEach(accountId -> sendToAccount(accountId, realtimeEnvelopeDto));
    }

    public void sendToSession(WebSocketSession webSocketSession, RealtimeEnvelopeDto realtimeEnvelopeDto) {
        if (!webSocketSession.isOpen()) {
            return;
        }

        send(webSocketSession, serializeEvent(realtimeEnvelopeDto));
    }

    public void sendToAllAccounts(RealtimeEnvelopeDto realtimeEnvelopeDto) {
        sendToAccounts(sessionsByAccountId.keySet(), realtimeEnvelopeDto);
    }

    public Set<UUID> getOnlineAccountIds() {
        Set<UUID> onlineAccountIds = new LinkedHashSet<>();
        sessionsByAccountId.forEach((accountId, sessions) -> {
            if (sessions.stream().anyMatch(WebSocketSession::isOpen)) {
                onlineAccountIds.add(accountId);
            }
        });
        return onlineAccountIds;
    }

    public OffsetDateTime getLastSeenAt(UUID accountId) {
        return lastSeenAtByAccountId.get(accountId);
    }

    public AccountPrincipal getAccountPrincipal(WebSocketSession webSocketSession) {
        Object accountPrincipal = webSocketSession.getAttributes().get(ACCOUNT_PRINCIPAL_ATTRIBUTE);

        if (accountPrincipal instanceof AccountPrincipal principal) {
            return principal;
        }

        return null;
    }

    private String serializeEvent(RealtimeEnvelopeDto realtimeEnvelopeDto) {
        try {
            return objectMapper.writeValueAsString(realtimeEnvelopeDto);
        }
        catch (Exception exception) {
            throw new IllegalStateException("Failed to serialize realtime event.", exception);
        }
    }

    private void send(WebSocketSession webSocketSession, String serializedEvent) {
        if (!webSocketSession.isOpen()) {
            return;
        }

        try {
            synchronized (webSocketSession) {
                if (webSocketSession.isOpen()) {
                    webSocketSession.sendMessage(new TextMessage(serializedEvent));
                }
            }
        }
        catch (IOException | IllegalStateException exception) {
            log.warn("Failed to send WebSocket message. Session ID: {}.", webSocketSession.getId(), exception);
            unregister(webSocketSession);
        }
    }
}

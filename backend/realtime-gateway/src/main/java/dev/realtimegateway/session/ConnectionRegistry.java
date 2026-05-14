package dev.realtimegateway.session;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.realtimegateway.model.dto.RealtimeEnvelopeDto;
import dev.realtimegateway.security.AccountPrincipal;
import java.io.IOException;
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

    public void register(WebSocketSession webSocketSession, AccountPrincipal accountPrincipal) {
        webSocketSession.getAttributes().put(ACCOUNT_PRINCIPAL_ATTRIBUTE, accountPrincipal);
        sessionsByAccountId
            .computeIfAbsent(accountPrincipal.accountId(), ignoredAccountId -> ConcurrentHashMap.newKeySet())
            .add(webSocketSession);
        log.info("WebSocket session registered. Session ID: {}, account ID: {}.", webSocketSession.getId(), accountPrincipal.accountId());
    }

    public void unregister(WebSocketSession webSocketSession) {
        AccountPrincipal accountPrincipal = getAccountPrincipal(webSocketSession);

        if (accountPrincipal == null) {
            return;
        }

        Set<WebSocketSession> sessions = sessionsByAccountId.get(accountPrincipal.accountId());

        if (sessions != null) {
            sessions.remove(webSocketSession);

            if (sessions.isEmpty()) {
                sessionsByAccountId.remove(accountPrincipal.accountId());
            }
        }

        log.info("WebSocket session unregistered. Session ID: {}, account ID: {}.", webSocketSession.getId(), accountPrincipal.accountId());
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

    private AccountPrincipal getAccountPrincipal(WebSocketSession webSocketSession) {
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
        try {
            synchronized (webSocketSession) {
                webSocketSession.sendMessage(new TextMessage(serializedEvent));
            }
        }
        catch (IOException exception) {
            log.warn("Failed to send WebSocket message. Session ID: {}.", webSocketSession.getId(), exception);
        }
    }
}

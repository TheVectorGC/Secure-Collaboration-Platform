package dev.realtimegateway.session;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.realtimegateway.model.dto.RealtimeEnvelopeDto;
import dev.realtimegateway.presence.PresenceAccountStatus;
import dev.realtimegateway.presence.PresenceService;
import dev.realtimegateway.security.AccountPrincipal;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
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
    private final PresenceService presenceService;
    private final Map<UUID, Set<WebSocketSession>> sessionsByAccountId = new ConcurrentHashMap<>();
    private final Map<String, ReentrantLock> sendLocksBySessionId = new ConcurrentHashMap<>();

    public boolean register(WebSocketSession webSocketSession, AccountPrincipal accountPrincipal) {
        webSocketSession.getAttributes().put(ACCOUNT_PRINCIPAL_ATTRIBUTE, accountPrincipal);
        sendLocksBySessionId.put(webSocketSession.getId(), new ReentrantLock());
        Set<WebSocketSession> sessions = sessionsByAccountId.computeIfAbsent(
                accountPrincipal.accountId(),
                ignoredAccountId -> ConcurrentHashMap.newKeySet()
        );
        boolean wasOffline = sessions.stream().noneMatch(WebSocketSession::isOpen);
        sessions.add(webSocketSession);
        presenceService.markOnline(accountPrincipal.accountId());
        log.info("WebSocket session registered. sessionId={}, accountId={}.", webSocketSession.getId(), accountPrincipal.accountId());
        return wasOffline;
    }

    public boolean unregister(WebSocketSession webSocketSession) {
        AccountPrincipal accountPrincipal = getAccountPrincipal(webSocketSession);
        sendLocksBySessionId.remove(webSocketSession.getId());

        if (accountPrincipal == null) {
            return false;
        }

        Set<WebSocketSession> sessions = sessionsByAccountId.get(accountPrincipal.accountId());

        if (sessions == null) {
            return false;
        }

        sessions.remove(webSocketSession);
        sessions.removeIf(session -> !session.isOpen());

        if (sessions.isEmpty()) {
            sessionsByAccountId.remove(accountPrincipal.accountId());
            presenceService.markOffline(accountPrincipal.accountId());
            log.info("WebSocket account went offline. accountId={}.", accountPrincipal.accountId());
            return true;
        }

        log.info("WebSocket session unregistered. sessionId={}, accountId={}.", webSocketSession.getId(), accountPrincipal.accountId());
        return false;
    }

    public void refreshPresence(WebSocketSession webSocketSession) {
        AccountPrincipal accountPrincipal = getAccountPrincipal(webSocketSession);

        if (accountPrincipal == null) {
            return;
        }

        presenceService.markOnline(accountPrincipal.accountId());
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
        if (accountIds == null || accountIds.isEmpty()) {
            return;
        }

        accountIds.stream()
                .filter(Objects::nonNull)
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

    public List<PresenceAccountStatus> getOnlineAccounts() {
        return presenceService.getOnlineAccounts();
    }

    public OffsetDateTime getLastSeenAt(UUID accountId) {
        return presenceService.getLastSeenAt(accountId);
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

        ReentrantLock sendLock = sendLocksBySessionId.get(webSocketSession.getId());

        if (sendLock == null) {
            return;
        }

        sendLock.lock();
        try {
            if (webSocketSession.isOpen()) {
                webSocketSession.sendMessage(new TextMessage(serializedEvent));
            }
        }
        catch (IOException exception) {
            log.debug("WebSocket message was not sent because the session was already closed. sessionId={}, reason={}.", webSocketSession.getId(), exception.getMessage());
            unregister(webSocketSession);
        }
        catch (IllegalStateException exception) {
            log.debug("WebSocket message was not sent because the session is not writable. sessionId={}, reason={}.", webSocketSession.getId(), exception.getMessage());
            unregister(webSocketSession);
        }
        finally {
            sendLock.unlock();
        }
    }
}

package dev.realtimegateway.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.realtimegateway.model.dto.ClientTypingEventDto;
import dev.realtimegateway.model.dto.RealtimeEnvelopeDto;
import dev.realtimegateway.model.enumeration.MessagingEventType;
import dev.realtimegateway.security.AccountPrincipal;
import dev.realtimegateway.service.WebSocketAuthenticationService;
import dev.realtimegateway.session.ConnectionRegistry;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Slf4j
@Component
@RequiredArgsConstructor
public class RealtimeWebSocketHandler extends TextWebSocketHandler {
    private static final String TYPING_EVENT_TYPE = "TYPING";

    private final WebSocketAuthenticationService webSocketAuthenticationService;
    private final ConnectionRegistry connectionRegistry;
    private final ObjectMapper objectMapper;

    @Override
    public void afterConnectionEstablished(WebSocketSession webSocketSession) throws Exception {
        try {
            AccountPrincipal accountPrincipal = webSocketAuthenticationService.authenticate(webSocketSession);
            boolean becameOnline = connectionRegistry.register(webSocketSession, accountPrincipal);
            sendPresenceSnapshot(webSocketSession);

            if (becameOnline) {
                broadcastPresence(accountPrincipal.accountId(), true, null);
            }
        }
        catch (RuntimeException exception) {
            log.warn("WebSocket authentication failed. Session ID: {}.", webSocketSession.getId(), exception);
            webSocketSession.close(CloseStatus.POLICY_VIOLATION.withReason("Authentication failed."));
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession webSocketSession, TextMessage textMessage) throws Exception {
        if (!webSocketSession.isOpen()) {
            return;
        }

        AccountPrincipal accountPrincipal = connectionRegistry.getAccountPrincipal(webSocketSession);

        if (accountPrincipal == null) {
            closeUnauthenticatedSession(webSocketSession);
            return;
        }

        String payload = textMessage.getPayload();

        if ("ping".equalsIgnoreCase(payload)) {
            sendPongIfOpen(webSocketSession);
            return;
        }

        handleClientEvent(payload, accountPrincipal);
    }

    private void handleClientEvent(String payload, AccountPrincipal accountPrincipal) {
        try {
            ClientTypingEventDto clientTypingEventDto = objectMapper.readValue(payload, ClientTypingEventDto.class);

            if (!TYPING_EVENT_TYPE.equals(clientTypingEventDto.type())) {
                return;
            }

            if (clientTypingEventDto.chatId() == null || clientTypingEventDto.recipientAccountIds() == null) {
                return;
            }

            Boolean typing = clientTypingEventDto.isTyping();
            RealtimeEnvelopeDto realtimeEnvelopeDto = new RealtimeEnvelopeDto(
                    UUID.randomUUID(),
                    MessagingEventType.TYPING,
                    OffsetDateTime.now(),
                    objectMapper.valueToTree(Map.of(
                            "chatId", clientTypingEventDto.chatId(),
                            "typingAccountId", accountPrincipal.accountId(),
                            "username", accountPrincipal.username(),
                            "isTyping", typing != null && typing
                    ))
            );
            connectionRegistry.sendToAccounts(clientTypingEventDto.recipientAccountIds(), realtimeEnvelopeDto);
        }
        catch (Exception exception) {
            log.debug("Ignoring unsupported WebSocket client event.", exception);
        }
    }

    private void sendPresenceSnapshot(WebSocketSession webSocketSession) {
        List<Map<String, Object>> accounts = connectionRegistry.getOnlineAccountIds().stream()
                .map(accountId -> {
                    Map<String, Object> accountPresence = new LinkedHashMap<>();
                    accountPresence.put("accountId", accountId);
                    accountPresence.put("online", true);
                    accountPresence.put("lastSeenAt", null);
                    return accountPresence;
                })
                .toList();
        RealtimeEnvelopeDto realtimeEnvelopeDto = new RealtimeEnvelopeDto(
                UUID.randomUUID(),
                MessagingEventType.PRESENCE_SNAPSHOT,
                OffsetDateTime.now(),
                objectMapper.valueToTree(Map.of("accounts", accounts))
        );
        connectionRegistry.sendToSession(webSocketSession, realtimeEnvelopeDto);
    }

    private void broadcastPresence(UUID accountId, boolean online, OffsetDateTime lastSeenAt) {
        Map<String, Object> presencePayload = new LinkedHashMap<>();
        presencePayload.put("accountId", accountId);
        presencePayload.put("online", online);
        presencePayload.put("lastSeenAt", lastSeenAt);
        RealtimeEnvelopeDto realtimeEnvelopeDto = new RealtimeEnvelopeDto(
                UUID.randomUUID(),
                MessagingEventType.PRESENCE_UPDATED,
                OffsetDateTime.now(),
                objectMapper.valueToTree(presencePayload)
        );
        connectionRegistry.sendToAllAccounts(realtimeEnvelopeDto);
    }

    private void sendPongIfOpen(WebSocketSession webSocketSession) throws Exception {
        if (webSocketSession.isOpen()) {
            webSocketSession.sendMessage(new TextMessage("pong"));
        }
    }

    private void closeUnauthenticatedSession(WebSocketSession webSocketSession) throws Exception {
        if (webSocketSession.isOpen()) {
            webSocketSession.close(CloseStatus.POLICY_VIOLATION.withReason("Authentication required."));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession webSocketSession, CloseStatus closeStatus) {
        AccountPrincipal accountPrincipal = connectionRegistry.getAccountPrincipal(webSocketSession);
        boolean becameOffline = connectionRegistry.unregister(webSocketSession);

        if (becameOffline && accountPrincipal != null) {
            OffsetDateTime lastSeenAt = connectionRegistry.getLastSeenAt(accountPrincipal.accountId());
            broadcastPresence(accountPrincipal.accountId(), false, lastSeenAt);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession webSocketSession, Throwable exception) throws Exception {
        log.warn("WebSocket transport error. Session ID: {}.", webSocketSession.getId(), exception);
        afterConnectionClosed(webSocketSession, CloseStatus.SERVER_ERROR);

        if (webSocketSession.isOpen()) {
            webSocketSession.close(CloseStatus.SERVER_ERROR);
        }
    }
}

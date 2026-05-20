package dev.realtimegateway.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.realtimegateway.model.dto.ClientTypingEventDto;
import dev.realtimegateway.model.dto.RealtimeEnvelopeDto;
import dev.realtimegateway.model.enumeration.MessagingEventType;
import dev.realtimegateway.security.AccountPrincipal;
import dev.realtimegateway.service.WebSocketAuthenticationService;
import dev.realtimegateway.session.ConnectionRegistry;
import java.time.OffsetDateTime;
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
            connectionRegistry.register(webSocketSession, accountPrincipal);
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

        handleClientEvent(webSocketSession, payload, accountPrincipal);
    }

    private void handleClientEvent(WebSocketSession webSocketSession, String payload, AccountPrincipal accountPrincipal) {
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
            log.debug("Ignoring unsupported WebSocket client event. Session ID: {}.", webSocketSession.getId(), exception);
        }
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
        connectionRegistry.unregister(webSocketSession);
    }

    @Override
    public void handleTransportError(WebSocketSession webSocketSession, Throwable exception) throws Exception {
        log.warn("WebSocket transport error. Session ID: {}.", webSocketSession.getId(), exception);
        connectionRegistry.unregister(webSocketSession);
        webSocketSession.close(CloseStatus.SERVER_ERROR);
    }
}



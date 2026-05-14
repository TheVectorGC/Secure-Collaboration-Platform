package dev.realtimegateway.websocket;

import dev.realtimegateway.security.AccountPrincipal;
import dev.realtimegateway.service.WebSocketAuthenticationService;
import dev.realtimegateway.session.ConnectionRegistry;
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
    private final WebSocketAuthenticationService webSocketAuthenticationService;
    private final ConnectionRegistry connectionRegistry;

    @Override
    public void afterConnectionEstablished(WebSocketSession webSocketSession) throws Exception {
        try {
            AccountPrincipal accountPrincipal = webSocketAuthenticationService.authenticate(webSocketSession);
            connectionRegistry.register(webSocketSession, accountPrincipal);
        }
        catch (RuntimeException exception) {
            log.warn("WebSocket authentication failed. Session ID: {}.", webSocketSession.getId(), exception);

            if (webSocketSession.isOpen()) {
                webSocketSession.close(CloseStatus.POLICY_VIOLATION.withReason("Authentication failed."));
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession webSocketSession, TextMessage textMessage) throws Exception {
        if (!webSocketSession.isOpen()) {
            return;
        }

        if ("ping".equalsIgnoreCase(textMessage.getPayload())) {
            webSocketSession.sendMessage(new TextMessage("pong"));
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

        if (webSocketSession.isOpen()) {
            webSocketSession.close(CloseStatus.SERVER_ERROR);
        }
    }
}

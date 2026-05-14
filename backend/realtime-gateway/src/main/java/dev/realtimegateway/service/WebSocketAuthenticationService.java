package dev.realtimegateway.service;

import dev.realtimegateway.security.AccountPrincipal;
import org.springframework.web.socket.WebSocketSession;

public interface WebSocketAuthenticationService {
    AccountPrincipal authenticate(WebSocketSession webSocketSession);
}

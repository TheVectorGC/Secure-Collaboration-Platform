package dev.realtimegateway.service.impl;

import dev.realtimegateway.exception.WebSocketAuthenticationException;
import dev.realtimegateway.security.AccountPrincipal;
import dev.realtimegateway.service.JwtTokenService;
import dev.realtimegateway.service.WebSocketAuthenticationService;
import java.net.URI;
import java.util.Arrays;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

@Service
@RequiredArgsConstructor
public class WebSocketAuthenticationServiceImpl implements WebSocketAuthenticationService {
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenService jwtTokenService;

    @Override
    public AccountPrincipal authenticate(WebSocketSession webSocketSession) {
        String token = extractToken(webSocketSession);

        if (token == null || token.isBlank()) {
            throw new WebSocketAuthenticationException("WebSocket access token is missing.");
        }

        return jwtTokenService.validateTokenAndGetPrincipal(token);
    }

    private String extractToken(WebSocketSession webSocketSession) {
        String authorizationHeader = webSocketSession.getHandshakeHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        if (authorizationHeader != null && authorizationHeader.startsWith(BEARER_PREFIX)) {
            return authorizationHeader.substring(BEARER_PREFIX.length());
        }

        return extractTokenFromQuery(webSocketSession.getUri());
    }

    private String extractTokenFromQuery(URI uri) {
        if (uri == null || uri.getQuery() == null) {
            return null;
        }

        return Arrays.stream(uri.getQuery().split("&"))
            .filter(queryPart -> queryPart.startsWith("accessToken="))
            .map(queryPart -> queryPart.substring("accessToken=".length()))
            .findFirst()
            .orElse(null);
    }
}

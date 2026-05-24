package dev.realtimegateway.service.impl;

import dev.realtimegateway.exception.WebSocketAuthenticationException;
import dev.realtimegateway.security.AccountPrincipal;
import dev.realtimegateway.service.JwtTokenService;
import dev.realtimegateway.service.WebSocketAuthenticationService;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

@Service
@RequiredArgsConstructor
public class WebSocketAuthenticationServiceImpl implements WebSocketAuthenticationService {
    private static final String ACCESS_TOKEN_PARAMETER = "accessToken=";

    private final JwtTokenService jwtTokenService;

    @Override
    public AccountPrincipal authenticate(WebSocketSession webSocketSession) {
        String token = extractTokenFromQuery(webSocketSession.getUri());

        if (token == null || token.isBlank()) {
            throw new WebSocketAuthenticationException("WebSocket access token is missing.");
        }

        AccountPrincipal accountPrincipal = jwtTokenService.validateTokenAndGetPrincipal(token);
        return new AccountPrincipal(accountPrincipal.accountId(), accountPrincipal.username(), accountPrincipal.roles(), token);
    }

    private String extractTokenFromQuery(URI uri) {
        if (uri == null || uri.getRawQuery() == null) {
            return null;
        }

        return Arrays.stream(uri.getRawQuery().split("&"))
                .filter(queryPart -> queryPart.startsWith(ACCESS_TOKEN_PARAMETER))
                .map(queryPart -> queryPart.substring(ACCESS_TOKEN_PARAMETER.length()))
                .map(encodedToken -> URLDecoder.decode(encodedToken, StandardCharsets.UTF_8))
                .findFirst()
                .orElse(null);
    }
}
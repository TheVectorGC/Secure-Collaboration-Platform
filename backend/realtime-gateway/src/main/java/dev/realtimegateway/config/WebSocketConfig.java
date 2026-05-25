package dev.realtimegateway.config;

import dev.realtimegateway.properties.WebSocketProperties;
import dev.realtimegateway.websocket.RealtimeWebSocketHandler;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {
    private static final String ANY_ORIGIN_PATTERN = "*";

    private final RealtimeWebSocketHandler realtimeWebSocketHandler;
    private final WebSocketProperties webSocketProperties;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry webSocketHandlerRegistry) {
        webSocketHandlerRegistry
                .addHandler(realtimeWebSocketHandler, webSocketProperties.endpoint())
                .setAllowedOriginPatterns(resolveAllowedOriginPatterns());
    }

    private String[] resolveAllowedOriginPatterns() {
        List<String> allowedOrigins = webSocketProperties.allowedOrigins();
        List<String> allowedOriginPatterns = new ArrayList<>();

        if (allowedOrigins != null) {
            allowedOrigins.stream()
                    .filter(allowedOrigin -> allowedOrigin != null && !allowedOrigin.isBlank())
                    .map(String::trim)
                    .forEach(allowedOriginPatterns::add);
        }

        if (!allowedOriginPatterns.contains(ANY_ORIGIN_PATTERN)) {
            allowedOriginPatterns.add(ANY_ORIGIN_PATTERN);
        }

        return allowedOriginPatterns.toArray(String[]::new);
    }
}

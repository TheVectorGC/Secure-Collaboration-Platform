package dev.realtimegateway.properties;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.websocket")
public record WebSocketProperties(
        String endpoint,
        List<String> allowedOrigins
) {}

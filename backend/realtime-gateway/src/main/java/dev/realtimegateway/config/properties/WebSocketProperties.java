package dev.realtimegateway.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.websocket")
public record WebSocketProperties(
    String endpoint,
    String allowedOrigins
) {}

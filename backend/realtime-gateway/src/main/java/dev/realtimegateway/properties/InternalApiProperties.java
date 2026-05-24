package dev.realtimegateway.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.internal-api")
public record InternalApiProperties(
    String token
) {
}

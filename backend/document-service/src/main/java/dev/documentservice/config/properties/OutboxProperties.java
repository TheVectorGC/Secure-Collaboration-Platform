package dev.documentservice.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.outbox")
public record OutboxProperties(
    boolean enabled,
    int batchSize,
    long dispatchIntervalMs,
    int maxAttempts
) {}

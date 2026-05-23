package dev.messagingservice.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.outbox")
public record OutboxProperties(
        boolean enabled,
        int batchSize,
        long dispatchIntervalMs,
        long retryDelaySeconds,
        int maxAttempts
) {}

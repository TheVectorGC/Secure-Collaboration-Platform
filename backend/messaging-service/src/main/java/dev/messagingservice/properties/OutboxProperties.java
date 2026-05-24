package dev.messagingservice.properties;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.outbox")
public record OutboxProperties(
    boolean enabled,
    int batchSize,
    Duration dispatchInterval,
    Duration retryDelay,
    int maxAttempts
) {
}

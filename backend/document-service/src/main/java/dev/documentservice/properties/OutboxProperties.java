package dev.documentservice.properties;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.outbox")
public record OutboxProperties(
    boolean enabled,
    int batchSize,
    Duration dispatchInterval,
    int maxAttempts
) {
}

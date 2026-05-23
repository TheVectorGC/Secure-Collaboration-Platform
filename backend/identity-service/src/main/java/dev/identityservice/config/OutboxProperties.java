package dev.identityservice.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.outbox")
public record OutboxProperties(
        boolean enabled,
        String topic,
        int batchSize,
        Duration publishInterval
) {}

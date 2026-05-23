package dev.messagingservice.properties;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.rate-limit")
public record RateLimitProperties(
    boolean enabled,
    String redisKeyPrefix,
    long maxRequests,
    Duration window
) {}

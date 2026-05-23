package dev.realtimegateway.properties;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.presence")
public record PresenceProperties(
        String redisKeyPrefix,
        Duration onlineTtl
) {}

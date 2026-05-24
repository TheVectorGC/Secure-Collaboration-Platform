package dev.identityservice.properties;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.profile-cache")
public record ProfileCacheProperties(
        boolean enabled,
        String redisKeyPrefix,
        Duration ttl
) {}

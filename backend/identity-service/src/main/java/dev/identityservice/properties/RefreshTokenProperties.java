package dev.identityservice.properties;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.security.refresh-token")
public record RefreshTokenProperties(
        Duration expiration
) {}

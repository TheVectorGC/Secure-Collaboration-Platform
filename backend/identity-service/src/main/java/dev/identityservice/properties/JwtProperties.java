package dev.identityservice.properties;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.security.jwt")
public record JwtProperties(
        String issuer,
        String keyName,
        Duration accessTokenExpiration
) {}
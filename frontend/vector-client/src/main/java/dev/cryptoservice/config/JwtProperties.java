package dev.cryptoservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.security.jwt")
public record JwtProperties(
    String issuer,
    String keyName
) {}

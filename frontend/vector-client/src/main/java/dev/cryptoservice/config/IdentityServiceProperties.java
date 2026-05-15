package dev.cryptoservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.identity-service")
public record IdentityServiceProperties(
    String baseUrl,
    String internalDevicePath
) {}

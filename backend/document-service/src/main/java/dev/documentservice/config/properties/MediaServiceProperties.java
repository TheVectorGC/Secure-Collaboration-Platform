package dev.documentservice.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.media-service")
public record MediaServiceProperties(
    String baseUrl,
    String grantAccessPath) {}

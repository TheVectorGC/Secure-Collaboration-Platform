package dev.mediaservice.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.messaging-service")
public record MessagingServiceProperties(
    String baseUrl,
    String chatPath
) {}

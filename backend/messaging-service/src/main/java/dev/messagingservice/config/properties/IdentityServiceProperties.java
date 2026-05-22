package dev.messagingservice.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.identity-service")
public record IdentityServiceProperties(
        String baseUrl
) {
    public String normalizedBaseUrl() {
        if (baseUrl == null || baseUrl.trim().isEmpty()) {
            return "http://localhost:8085";
        }

        String trimmedBaseUrl = baseUrl.trim();

        if (trimmedBaseUrl.endsWith("/")) {
            return trimmedBaseUrl.substring(0, trimmedBaseUrl.length() - 1);
        }

        return trimmedBaseUrl;
    }
}

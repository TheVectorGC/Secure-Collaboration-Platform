package dev.identityservice.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.initial-admin")
public record InitialAdminProperties(
        boolean enabled,
        String username,
        String email,
        String password,
        String firstName,
        String lastName
) {}

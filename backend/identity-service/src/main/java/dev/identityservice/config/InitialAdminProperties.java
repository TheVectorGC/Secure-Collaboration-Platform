package dev.identityservice.config;

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

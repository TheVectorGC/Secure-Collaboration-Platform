package dev.cryptoservice.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.crypto.prekey")
public record PreKeyProperties(
    int lowThreshold
) {}

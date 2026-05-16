package dev.mediaservice.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.media.storage")
public record MediaStorageProperties(
    String rootPath,
    long maxFileSizeBytes
) {}

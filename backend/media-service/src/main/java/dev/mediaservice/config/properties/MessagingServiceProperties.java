package dev.mediaservice.config.properties;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "application.messaging-service")
public record MessagingServiceProperties(
    @NotBlank
    String baseUrl,

    @NotBlank
    String chatPath
) {}

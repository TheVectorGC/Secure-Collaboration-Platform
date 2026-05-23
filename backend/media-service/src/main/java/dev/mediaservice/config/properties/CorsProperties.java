package dev.mediaservice.config.properties;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "application.cors")
public record CorsProperties(
    @NotEmpty
    List<String> allowedOrigins
) {}

package dev.documentservice.config.properties;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.cors")
public record ApplicationCorsProperties(List<String> allowedOrigins) {}

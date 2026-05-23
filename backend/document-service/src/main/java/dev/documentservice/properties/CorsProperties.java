package dev.documentservice.properties;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.cors")
public record CorsProperties(List<String> allowedOrigins) {}

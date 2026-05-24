package dev.identityservice.properties;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.security")
public record SecurityProperties(
    List<String> publicPaths
) {
}

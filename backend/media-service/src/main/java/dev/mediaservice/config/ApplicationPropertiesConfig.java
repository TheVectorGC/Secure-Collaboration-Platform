package dev.mediaservice.config;

import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationPropertiesScan(basePackages = "dev.mediaservice.config.properties")
public class ApplicationPropertiesConfig {
}

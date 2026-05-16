package dev.documentservice.config;

import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationPropertiesScan(basePackages = "dev.documentservice.config.properties")
public class ApplicationPropertiesConfig {
}

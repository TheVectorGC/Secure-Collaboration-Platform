package dev.messagingservice.config;

import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationPropertiesScan(basePackages = "dev.messagingservice.config.properties")
public class ApplicationPropertiesConfig {
}
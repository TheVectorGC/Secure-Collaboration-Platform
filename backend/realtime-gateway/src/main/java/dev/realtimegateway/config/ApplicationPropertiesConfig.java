package dev.realtimegateway.config;

import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationPropertiesScan(basePackages = "dev.realtimegateway.config.properties")
public class ApplicationPropertiesConfig {
}

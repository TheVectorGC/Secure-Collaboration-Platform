package dev.cryptoservice.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({CorsProperties.class, IdentityServiceProperties.class, JwtProperties.class, PreKeyProperties.class, SecurityProperties.class})
public class ApplicationPropertiesConfig {
}

package dev.identityservice.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({
        CorsProperties.class,
        InitialAdminProperties.class,
        JwtProperties.class,
        OutboxProperties.class,
        RefreshTokenProperties.class
})
public class ApplicationPropertiesConfig {}

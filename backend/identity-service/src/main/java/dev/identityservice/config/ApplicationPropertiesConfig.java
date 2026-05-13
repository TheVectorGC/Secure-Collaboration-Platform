package dev.identityservice.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({JwtProperties.class, RefreshTokenProperties.class, InitialAdminProperties.class})
public class ApplicationPropertiesConfig {}

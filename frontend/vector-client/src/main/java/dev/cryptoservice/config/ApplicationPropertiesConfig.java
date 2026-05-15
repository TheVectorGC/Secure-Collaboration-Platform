package dev.cryptoservice.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({JwtProperties.class, IdentityServiceProperties.class, PreKeyProperties.class})
public class ApplicationPropertiesConfig {}

package dev.realtimegateway.config;

import dev.realtimegateway.properties.WebSocketProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {
    private static final String ACTUATOR_HEALTH_PATH = "/actuator/health";

    private final WebSocketProperties webSocketProperties;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity httpSecurity) throws Exception {
        String webSocketEndpoint = webSocketProperties.endpoint();
        String webSocketEndpointPattern = webSocketEndpoint.endsWith("/")
                ? webSocketEndpoint + "**"
                : webSocketEndpoint + "/**";

        return httpSecurity
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(webSocketEndpoint, webSocketEndpointPattern, ACTUATOR_HEALTH_PATH).permitAll()
                        .anyRequest().denyAll()
                )
                .build();
    }
}

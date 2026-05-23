package dev.realtimegateway.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Vector Realtime Gateway API")
                        .description("WebSocket gateway for encrypted messaging, document and presence events.")
                        .version("v1"));
    }
}

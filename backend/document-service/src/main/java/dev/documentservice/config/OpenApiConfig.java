package dev.documentservice.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    private static final String SECURITY_SCHEME_NAME = "bearerAuth";

    @Bean
    public OpenAPI documentServiceOpenApi() {
        return new OpenAPI()
            .info(new Info()
                .title("Vector Document Service API")
                .version("v1")
                .description("Document workflow API for encrypted files, signing keys, signatures, observers and document visibility."))
            .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
            .schemaRequirement(SECURITY_SCHEME_NAME, new SecurityScheme()
                .name(SECURITY_SCHEME_NAME)
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT"));
    }
}

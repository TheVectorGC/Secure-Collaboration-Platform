package dev.cryptoservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient identityServiceRestClient(IdentityServiceProperties identityServiceProperties) {
        return RestClient.builder()
            .baseUrl(identityServiceProperties.baseUrl())
            .build();
    }
}

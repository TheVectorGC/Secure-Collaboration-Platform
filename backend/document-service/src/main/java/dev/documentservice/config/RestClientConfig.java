package dev.documentservice.config;

import dev.documentservice.config.properties.IdentityServiceProperties;
import dev.documentservice.config.properties.MediaServiceProperties;
import dev.documentservice.config.properties.MessagingServiceProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {
    @Bean
    public RestClient messagingServiceRestClient(MessagingServiceProperties messagingServiceProperties) {
        return RestClient.builder()
            .baseUrl(messagingServiceProperties.baseUrl())
            .build();
    }

    @Bean
    public RestClient identityServiceRestClient(IdentityServiceProperties identityServiceProperties) {
        return RestClient.builder()
            .baseUrl(identityServiceProperties.baseUrl())
            .build();
    }

    @Bean
    public RestClient mediaServiceRestClient(MediaServiceProperties mediaServiceProperties) {
        return RestClient.builder()
            .baseUrl(mediaServiceProperties.baseUrl())
            .build();
    }
}

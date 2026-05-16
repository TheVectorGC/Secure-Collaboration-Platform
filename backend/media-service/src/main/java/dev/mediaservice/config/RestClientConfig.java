package dev.mediaservice.config;

import dev.mediaservice.config.properties.MessagingServiceProperties;
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
}

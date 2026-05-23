package dev.mediaservice.config;

import dev.mediaservice.properties.MessagingServiceProperties;
import dev.mediaservice.observability.RequestIdProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {
    private static final String REQUEST_ID_HEADER = "X-Request-Id";

    @Bean
    public RestClient messagingServiceRestClient(
        MessagingServiceProperties messagingServiceProperties,
        RequestIdProvider requestIdProvider
    ) {
        return RestClient.builder()
            .baseUrl(messagingServiceProperties.baseUrl())
            .requestInterceptor((request, body, execution) -> {
                String requestId = requestIdProvider.getCurrentRequestId();
                if (requestId != null) {
                    request.getHeaders().set(REQUEST_ID_HEADER, requestId);
                }
                request.getHeaders().set(HttpHeaders.ACCEPT, "application/json");
                return execution.execute(request, body);
            })
            .build();
    }
}

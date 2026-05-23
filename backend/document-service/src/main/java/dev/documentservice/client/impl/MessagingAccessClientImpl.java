package dev.documentservice.client.impl;

import dev.documentservice.client.MessagingAccessClient;
import dev.documentservice.properties.MessagingServiceProperties;
import dev.documentservice.exception.DocumentAccessDeniedException;
import dev.documentservice.exception.ExternalServiceException;
import dev.documentservice.model.dto.response.InternalChatResponseDto;
import dev.documentservice.observability.RequestIdProvider;
import dev.documentservice.security.AuthorizationHeaderProvider;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Slf4j
@Component
@RequiredArgsConstructor
public class MessagingAccessClientImpl implements MessagingAccessClient {
    private final RestClient messagingServiceRestClient;
    private final MessagingServiceProperties messagingServiceProperties;
    private final AuthorizationHeaderProvider authorizationHeaderProvider;
    private final RequestIdProvider requestIdProvider;

    @Override
    public InternalChatResponseDto validateCurrentAccountCanAccessChat(UUID chatId) {
        try {
            return messagingServiceRestClient.get()
                    .uri(messagingServiceProperties.chatPath(), chatId)
                    .header(HttpHeaders.AUTHORIZATION, authorizationHeaderProvider.getAuthorizationHeader())
                    .header(RequestIdProvider.HEADER_NAME, requestIdProvider.getCurrentRequestId())
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                        throw new DocumentAccessDeniedException("Current account does not have access to document chat.");
                    })
                    .onStatus(HttpStatusCode::is5xxServerError, (request, response) -> {
                        throw new ExternalServiceException("Messaging-service is unavailable for document access validation.");
                    })
                    .body(InternalChatResponseDto.class);
        } catch (RestClientException exception) {
            log.warn("Failed to validate document chat access. Chat ID: {}.", chatId, exception);
            throw new ExternalServiceException("Failed to validate document chat access.", exception);
        }
    }
}

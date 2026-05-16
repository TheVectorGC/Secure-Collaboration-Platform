package dev.mediaservice.client.impl;

import dev.mediaservice.client.MessagingAccessClient;
import dev.mediaservice.config.properties.MessagingServiceProperties;
import dev.mediaservice.exception.MediaAccessDeniedException;
import dev.mediaservice.exception.MediaStorageException;
import dev.mediaservice.model.dto.response.InternalChatResponseDto;
import dev.mediaservice.security.AuthorizationHeaderProvider;
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

    @Override
    public InternalChatResponseDto validateCurrentAccountCanAccessChat(UUID chatId) {
        try {
            return messagingServiceRestClient.get()
                    .uri(messagingServiceProperties.chatPath(), chatId)
                    .header(HttpHeaders.AUTHORIZATION, authorizationHeaderProvider.getAuthorizationHeader())
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                        throw new MediaAccessDeniedException("Current account does not have access to media chat.");
                    })
                    .onStatus(HttpStatusCode::is5xxServerError, (request, response) -> {
                        throw new MediaStorageException("Messaging-service is unavailable for media access validation.");
                    })
                    .body(InternalChatResponseDto.class);
        }
        catch (MediaAccessDeniedException | MediaStorageException exception) {
            throw exception;
        }
        catch (RestClientException exception) {
            log.warn("Failed to validate media chat access. Chat ID: {}.", chatId, exception);
            throw new MediaStorageException("Failed to validate media chat access.", exception);
        }
    }
}

package dev.documentservice.client.impl;

import dev.documentservice.client.MediaAccessClient;
import dev.documentservice.config.properties.MediaServiceProperties;
import dev.documentservice.exception.ExternalServiceException;
import dev.documentservice.model.dto.request.GrantMediaAccessRequestDto;
import dev.documentservice.security.AuthorizationHeaderProvider;
import java.util.ArrayList;
import java.util.Collection;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Slf4j
@Component
@RequiredArgsConstructor
public class MediaAccessClientImpl implements MediaAccessClient {
    private final RestClient mediaServiceRestClient;
    private final MediaServiceProperties mediaServiceProperties;
    private final AuthorizationHeaderProvider authorizationHeaderProvider;

    @Override
    public void grantMediaAccess(UUID mediaFileId, Collection<UUID> accountIds) {
        if (accountIds == null || accountIds.isEmpty()) {
            return;
        }

        try {
            mediaServiceRestClient.patch()
                .uri(mediaServiceProperties.grantAccessPath(), mediaFileId)
                .header(HttpHeaders.AUTHORIZATION, authorizationHeaderProvider.getAuthorizationHeader())
                .body(new GrantMediaAccessRequestDto(new ArrayList<>(accountIds)))
                .retrieve()
                .toBodilessEntity();
        }
        catch (RestClientException exception) {
            log.warn("Failed to grant media access. Media file ID: {}.", mediaFileId, exception);
            throw new ExternalServiceException("Failed to grant media access.", exception);
        }
    }
}

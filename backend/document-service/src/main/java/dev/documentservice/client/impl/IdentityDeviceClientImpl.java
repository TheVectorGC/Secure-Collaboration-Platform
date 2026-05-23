package dev.documentservice.client.impl;

import dev.documentservice.client.IdentityDeviceClient;
import dev.documentservice.config.properties.IdentityServiceProperties;
import dev.documentservice.exception.DocumentAccessDeniedException;
import dev.documentservice.exception.ExternalServiceException;
import dev.documentservice.model.dto.response.InternalDeviceResponseDto;
import dev.documentservice.provider.RequestIdProvider;
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
public class IdentityDeviceClientImpl implements IdentityDeviceClient {
    private final RestClient identityServiceRestClient;
    private final IdentityServiceProperties identityServiceProperties;
    private final AuthorizationHeaderProvider authorizationHeaderProvider;
    private final RequestIdProvider requestIdProvider;

    @Override
    public InternalDeviceResponseDto getDevice(UUID deviceId) {
        try {
            return identityServiceRestClient.get()
                    .uri(identityServiceProperties.internalDevicePath(), deviceId)
                    .header(HttpHeaders.AUTHORIZATION, authorizationHeaderProvider.getAuthorizationHeader())
                    .header(RequestIdProvider.HEADER_NAME, requestIdProvider.getCurrentRequestId())
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                        throw new DocumentAccessDeniedException("Current account cannot use this device for document signing.");
                    })
                    .onStatus(HttpStatusCode::is5xxServerError, (request, response) -> {
                        throw new ExternalServiceException("Identity-service is unavailable for document signing device validation.");
                    })
                    .body(InternalDeviceResponseDto.class);
        } catch (RestClientException exception) {
            log.warn("Failed to request device from identity-service. Device ID: {}.", deviceId, exception);
            throw new ExternalServiceException("Failed to request device from identity-service.", exception);
        }
    }
}

package dev.cryptoservice.client.impl;

import dev.cryptoservice.client.IdentityDeviceClient;
import dev.cryptoservice.properties.IdentityServiceProperties;
import dev.cryptoservice.exception.DeviceNotFoundException;
import dev.cryptoservice.exception.ExternalServiceException;
import dev.cryptoservice.model.dto.response.InternalDeviceResponseDto;
import dev.cryptoservice.security.AuthorizationHeaderProvider;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    @Override
    public InternalDeviceResponseDto getDevice(UUID deviceId) {
        try {
            return identityServiceRestClient.get()
                    .uri(identityServiceProperties.internalDevicePath(), deviceId)
                    .header("Authorization", authorizationHeaderProvider.getAuthorizationHeader())
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                        throw new DeviceNotFoundException("Device with ID '" + deviceId + "' was not found in identity-service.");
                    })
                    .onStatus(HttpStatusCode::is5xxServerError, (request, response) -> {
                        throw new ExternalServiceException("Identity-service is unavailable.");
                    })
                    .body(InternalDeviceResponseDto.class);
        }
        catch (RestClientException exception) {
            log.warn("Failed to request device from identity-service. Device ID: {}.", deviceId, exception);
            throw new ExternalServiceException("Failed to request device from identity-service.", exception);
        }
    }
}
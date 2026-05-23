package dev.messagingservice.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.messagingservice.config.properties.IdentityServiceProperties;
import dev.messagingservice.exception.DeviceDirectoryUnavailableException;
import dev.messagingservice.model.dto.internal.ActiveDeviceDirectoryEntryDto;
import dev.messagingservice.service.CurrentAuthorizationHeaderService;
import dev.messagingservice.service.IdentityDeviceDirectoryClient;
import dev.messagingservice.web.RequestIdProvider;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class HttpIdentityDeviceDirectoryClient implements IdentityDeviceDirectoryClient {
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);

    private final IdentityServiceProperties identityServiceProperties;
    private final CurrentAuthorizationHeaderService currentAuthorizationHeaderService;
    private final RequestIdProvider requestIdProvider;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public HttpIdentityDeviceDirectoryClient(
            IdentityServiceProperties identityServiceProperties,
            CurrentAuthorizationHeaderService currentAuthorizationHeaderService,
            RequestIdProvider requestIdProvider,
            ObjectMapper objectMapper
    ) {
        this.identityServiceProperties = identityServiceProperties;
        this.currentAuthorizationHeaderService = currentAuthorizationHeaderService;
        this.requestIdProvider = requestIdProvider;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(REQUEST_TIMEOUT)
                .build();
    }

    @Override
    public List<ActiveDeviceDirectoryEntryDto> getActiveAccountDevices(UUID accountId) {
        String encodedAccountId = URLEncoder.encode(accountId.toString(), StandardCharsets.UTF_8);
        URI uri = URI.create(identityServiceProperties.normalizedBaseUrl() + "/api/v1/devices/accounts/" + encodedAccountId + "/active");
        HttpRequest httpRequest = HttpRequest.newBuilder(uri)
                .timeout(REQUEST_TIMEOUT)
                .header("Authorization", currentAuthorizationHeaderService.getCurrentAuthorizationHeader())
                .header("Accept", "application/json")
                .header(RequestIdProvider.REQUEST_ID_HEADER, requestIdProvider.getCurrentRequestId())
                .GET()
                .build();

        try {
            HttpResponse<String> httpResponse = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (httpResponse.statusCode() < 200 || httpResponse.statusCode() >= 300) {
                log.warn("Identity service active devices request failed. Account ID: {}, status: {}.", accountId, httpResponse.statusCode());
                throw new DeviceDirectoryUnavailableException("Active device directory is not available.");
            }

            ActiveDeviceDirectoryEntryDto[] activeDeviceDirectoryEntries = objectMapper.readValue(
                    httpResponse.body(),
                    ActiveDeviceDirectoryEntryDto[].class
            );
            return Arrays.stream(activeDeviceDirectoryEntries)
                    .filter(activeDeviceDirectoryEntry -> activeDeviceDirectoryEntry.deviceId() != null)
                    .toList();
        }
        catch (IOException exception) {
            throw new DeviceDirectoryUnavailableException("Active device directory response could not be read.", exception);
        }
        catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new DeviceDirectoryUnavailableException("Active device directory request was interrupted.", exception);
        }
    }
}

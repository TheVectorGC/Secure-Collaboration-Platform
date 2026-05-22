package dev.messagingservice.model.dto.internal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ActiveDeviceDirectoryEntryDto(
        UUID deviceId,
        UUID accountId,
        String status
) {}

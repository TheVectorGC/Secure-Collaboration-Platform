package dev.messagingservice.service;

import dev.messagingservice.model.dto.internal.ActiveDeviceDirectoryEntryDto;
import java.util.List;
import java.util.UUID;

public interface IdentityDeviceDirectoryClient {
    List<ActiveDeviceDirectoryEntryDto> getActiveAccountDevices(UUID accountId);
}

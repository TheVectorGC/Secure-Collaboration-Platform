package dev.identityservice.service.cache;

import dev.identityservice.model.dto.response.AccountProfileResponseDto;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;

public interface ProfileCacheService {
    Map<UUID, AccountProfileResponseDto> findByAccountIds(Collection<UUID> accountIds);

    void save(AccountProfileResponseDto accountProfileResponseDto);

    void evict(UUID accountId);
}

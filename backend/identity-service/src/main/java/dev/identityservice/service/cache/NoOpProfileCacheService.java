package dev.identityservice.service.cache;

import dev.identityservice.model.dto.response.AccountProfileResponseDto;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "application.profile-cache", name = "enabled", havingValue = "false", matchIfMissing = true)
public class NoOpProfileCacheService implements ProfileCacheService {
    @Override
    public Map<UUID, AccountProfileResponseDto> findByAccountIds(Collection<UUID> accountIds) {
        return Map.of();
    }

    @Override
    public void save(AccountProfileResponseDto accountProfileResponseDto) {
    }

    @Override
    public void evict(UUID accountId) {
    }
}

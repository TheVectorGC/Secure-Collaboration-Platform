package dev.identityservice.service.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.identityservice.model.dto.response.AccountProfileResponseDto;
import dev.identityservice.properties.ProfileCacheProperties;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "application.profile-cache", name = "enabled", havingValue = "true")
public class RedisProfileCacheService implements ProfileCacheService {
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final ProfileCacheProperties profileCacheProperties;

    @Override
    public Map<UUID, AccountProfileResponseDto> findByAccountIds(Collection<UUID> accountIds) {
        Map<UUID, AccountProfileResponseDto> result = new LinkedHashMap<>();

        if (accountIds == null || accountIds.isEmpty()) {
            return result;
        }

        accountIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .forEach(accountId -> findByAccountId(accountId, result));

        return result;
    }

    @Override
    public void save(AccountProfileResponseDto accountProfileResponseDto) {
        if (accountProfileResponseDto == null || accountProfileResponseDto.accountId() == null) {
            return;
        }

        try {
            String value = objectMapper.writeValueAsString(accountProfileResponseDto);
            stringRedisTemplate.opsForValue().set(cacheKey(accountProfileResponseDto.accountId()), value, profileCacheProperties.ttl());
        }
        catch (Exception exception) {
            log.debug("Failed to save profile cache. accountId={}", accountProfileResponseDto.accountId(), exception);
        }
    }

    @Override
    public void evict(UUID accountId) {
        if (accountId == null) {
            return;
        }

        try {
            stringRedisTemplate.delete(cacheKey(accountId));
        }
        catch (Exception exception) {
            log.debug("Failed to evict profile cache. accountId={}", accountId, exception);
        }
    }

    private void findByAccountId(UUID accountId, Map<UUID, AccountProfileResponseDto> result) {
        try {
            String value = stringRedisTemplate.opsForValue().get(cacheKey(accountId));

            if (value == null || value.isBlank()) {
                return;
            }

            AccountProfileResponseDto accountProfileResponseDto = objectMapper.readValue(value, AccountProfileResponseDto.class);
            result.put(accountId, accountProfileResponseDto);
        }
        catch (Exception exception) {
            log.debug("Failed to read profile cache. accountId={}", accountId, exception);
            evict(accountId);
        }
    }

    private String cacheKey(UUID accountId) {
        return profileCacheProperties.redisKeyPrefix() + ":" + accountId;
    }
}

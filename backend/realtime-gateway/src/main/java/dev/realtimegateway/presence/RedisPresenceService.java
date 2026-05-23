package dev.realtimegateway.presence;

import dev.realtimegateway.config.properties.PresenceProperties;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class RedisPresenceService implements PresenceService {
    private static final String ONLINE_KEY_PART = "online";
    private static final String LAST_SEEN_KEY_PART = "last-seen";

    private final StringRedisTemplate stringRedisTemplate;
    private final PresenceProperties presenceProperties;

    @Override
    public void markOnline(UUID accountId) {
        stringRedisTemplate.opsForValue().set(onlineKey(accountId), "true", presenceProperties.onlineTtl());
        stringRedisTemplate.delete(lastSeenKey(accountId));
        log.debug("Presence marked online. Account ID: {}.", accountId);
    }

    @Override
    public void markOffline(UUID accountId) {
        OffsetDateTime lastSeenAt = OffsetDateTime.now();
        stringRedisTemplate.delete(onlineKey(accountId));
        stringRedisTemplate.opsForValue().set(lastSeenKey(accountId), lastSeenAt.toString());
        log.debug("Presence marked offline. Account ID: {}, last seen at: {}.", accountId, lastSeenAt);
    }

    @Override
    public List<PresenceAccountStatus> getOnlineAccounts() {
        Set<String> onlineKeys = stringRedisTemplate.keys(keyPrefix() + ":" + ONLINE_KEY_PART + ":*");

        if (onlineKeys == null || onlineKeys.isEmpty()) {
            return List.of();
        }

        return onlineKeys.stream()
                .map(this::accountIdFromOnlineKey)
                .flatMap(java.util.Optional::stream)
                .map(accountId -> new PresenceAccountStatus(accountId, true, null))
                .toList();
    }

    @Override
    public OffsetDateTime getLastSeenAt(UUID accountId) {
        String lastSeenAt = stringRedisTemplate.opsForValue().get(lastSeenKey(accountId));

        if (lastSeenAt == null || lastSeenAt.isBlank()) {
            return null;
        }

        return OffsetDateTime.parse(lastSeenAt);
    }

    private java.util.Optional<UUID> accountIdFromOnlineKey(String onlineKey) {
        String marker = ":" + ONLINE_KEY_PART + ":";
        int markerIndex = onlineKey.lastIndexOf(marker);

        if (markerIndex < 0) {
            return java.util.Optional.empty();
        }

        try {
            return java.util.Optional.of(UUID.fromString(onlineKey.substring(markerIndex + marker.length())));
        }
        catch (IllegalArgumentException exception) {
            log.debug("Ignoring invalid Redis presence key. Key: {}.", onlineKey);
            return java.util.Optional.empty();
        }
    }

    private String onlineKey(UUID accountId) {
        return keyPrefix() + ":" + ONLINE_KEY_PART + ":" + accountId;
    }

    private String lastSeenKey(UUID accountId) {
        return keyPrefix() + ":" + LAST_SEEN_KEY_PART + ":" + accountId;
    }

    private String keyPrefix() {
        return presenceProperties.redisKeyPrefix();
    }
}

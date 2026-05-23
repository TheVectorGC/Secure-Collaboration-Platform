package dev.identityservice.security.ratelimit;

import dev.identityservice.properties.RateLimitProperties;
import java.time.Instant;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "application.rate-limit", name = "enabled", havingValue = "true")
public class RedisRateLimiter {
    private final StringRedisTemplate stringRedisTemplate;
    private final RateLimitProperties rateLimitProperties;

    public boolean isAllowed(String clientKey) {
        long windowSeconds = Math.max(1L, rateLimitProperties.window().toSeconds());
        long windowNumber = Instant.now().getEpochSecond() / windowSeconds;
        String redisKey = rateLimitProperties.redisKeyPrefix() + ":" + clientKey + ":" + windowNumber;
        Long requestCount = stringRedisTemplate.opsForValue().increment(redisKey);

        if (requestCount != null && requestCount == 1L) {
            stringRedisTemplate.expire(redisKey, windowSeconds + 1L, TimeUnit.SECONDS);
        }

        return requestCount == null || requestCount <= rateLimitProperties.maxRequests();
    }
}

package dev.cryptoservice.security.ratelimit;

import dev.cryptoservice.properties.RateLimitProperties;
import io.lettuce.core.RedisCommandTimeoutException;
import io.lettuce.core.RedisConnectionException;
import java.time.Instant;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "application.rate-limit", name = "enabled", havingValue = "true")
public class RedisRateLimiter {
    private final StringRedisTemplate stringRedisTemplate;
    private final RateLimitProperties rateLimitProperties;

    public boolean isAllowed(String clientKey) {
        try {
            return isAllowedWithRedis(clientKey);
        }
        catch (RedisConnectionFailureException
               | RedisSystemException
               | QueryTimeoutException
               | RedisCommandTimeoutException
               | RedisConnectionException exception) {
            log.warn("Redis rate limit check failed. Request is allowed. clientKey={}, reason={}", clientKey, exception.getMessage());
            return true;
        }
        catch (RuntimeException exception) {
            log.warn("Unexpected Redis rate limit error. Request is allowed. clientKey={}, reason={}", clientKey, exception.getMessage());
            return true;
        }
    }

    private boolean isAllowedWithRedis(String clientKey) {
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

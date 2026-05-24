package dev.realtimegateway.properties;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.typing.recipients-cache")
public record TypingRecipientsCacheProperties(
        String redisKeyPrefix,
        Duration stableChatTtl,
        Duration groupChatTtl
) {}

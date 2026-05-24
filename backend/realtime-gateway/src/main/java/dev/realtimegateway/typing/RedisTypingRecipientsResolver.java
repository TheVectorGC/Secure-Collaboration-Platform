package dev.realtimegateway.typing;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.realtimegateway.model.dto.messaging.MessagingChatResponseDto;
import dev.realtimegateway.properties.MessagingServiceProperties;
import dev.realtimegateway.properties.TypingRecipientsCacheProperties;
import dev.realtimegateway.security.AccountPrincipal;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Slf4j
@Service
@RequiredArgsConstructor
public class RedisTypingRecipientsResolver implements TypingRecipientsResolver {
    private static final String SELF_CHAT_TYPE = "SELF";
    private static final String DIRECT_CHAT_TYPE = "DIRECT";

    private final RestClient messagingServiceRestClient;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final MessagingServiceProperties messagingServiceProperties;
    private final TypingRecipientsCacheProperties typingRecipientsCacheProperties;

    @Override
    public List<UUID> resolveRecipientAccountIds(UUID chatId, AccountPrincipal accountPrincipal) {
        if (chatId == null || accountPrincipal == null) {
            return List.of();
        }

        TypingRecipientsRoute cachedRoute = findCachedRoute(chatId);

        if (cachedRoute != null) {
            return cachedRoute.recipientAccountIds();
        }

        TypingRecipientsRoute route = loadRoute(chatId, accountPrincipal);
        cacheRoute(route);
        return route.recipientAccountIds();
    }

    @Override
    public void invalidateChat(UUID chatId) {
        if (chatId == null) {
            return;
        }

        stringRedisTemplate.delete(cacheKey(chatId));
    }

    private TypingRecipientsRoute findCachedRoute(UUID chatId) {
        String value = stringRedisTemplate.opsForValue().get(cacheKey(chatId));

        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return objectMapper.readValue(value, TypingRecipientsRoute.class);
        }
        catch (Exception exception) {
            log.debug("Failed to read cached typing route. chatId={}", chatId, exception);
            stringRedisTemplate.delete(cacheKey(chatId));
            return null;
        }
    }

    private TypingRecipientsRoute loadRoute(UUID chatId, AccountPrincipal accountPrincipal) {
        try {
            MessagingChatResponseDto chatResponseDto = messagingServiceRestClient.get()
                    .uri(messagingServiceProperties.chatPath(), chatId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accountPrincipal.accessToken())
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> {
                        throw new IllegalStateException("Cannot resolve typing recipients.");
                    })
                    .body(MessagingChatResponseDto.class);

            if (chatResponseDto == null || chatResponseDto.participantAccountIds() == null) {
                return new TypingRecipientsRoute(chatId, "UNKNOWN", List.of());
            }

            List<UUID> recipientAccountIds = chatResponseDto.participantAccountIds().stream()
                    .filter(Objects::nonNull)
                    .filter(accountId -> !accountId.equals(accountPrincipal.accountId()))
                    .distinct()
                    .toList();

            return new TypingRecipientsRoute(chatId, chatResponseDto.type(), recipientAccountIds);
        }
        catch (RestClientException | IllegalStateException exception) {
            log.debug("Failed to resolve typing recipients. chatId={}, accountId={}", chatId, accountPrincipal.accountId(), exception);
            return new TypingRecipientsRoute(chatId, "UNKNOWN", List.of());
        }
    }

    private void cacheRoute(TypingRecipientsRoute route) {
        try {
            Duration ttl = ttlForChatType(route.chatType());
            String value = objectMapper.writeValueAsString(route);
            stringRedisTemplate.opsForValue().set(cacheKey(route.chatId()), value, ttl);
        }
        catch (Exception exception) {
            log.debug("Failed to cache typing route. chatId={}", route.chatId(), exception);
        }
    }

    private Duration ttlForChatType(String chatType) {
        if (SELF_CHAT_TYPE.equals(chatType) || DIRECT_CHAT_TYPE.equals(chatType)) {
            return typingRecipientsCacheProperties.stableChatTtl();
        }

        return typingRecipientsCacheProperties.groupChatTtl();
    }

    private String cacheKey(UUID chatId) {
        return typingRecipientsCacheProperties.redisKeyPrefix() + ":" + chatId;
    }
}

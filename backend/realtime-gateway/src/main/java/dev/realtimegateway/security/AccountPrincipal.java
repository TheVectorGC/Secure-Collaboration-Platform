package dev.realtimegateway.security;

import java.util.List;
import java.util.UUID;

public record AccountPrincipal(
        UUID accountId,
        String username,
        List<String> roles,
        String accessToken
) {}

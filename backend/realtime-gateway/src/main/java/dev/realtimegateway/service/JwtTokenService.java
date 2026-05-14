package dev.realtimegateway.service;

import dev.realtimegateway.security.AccountPrincipal;

public interface JwtTokenService {
    AccountPrincipal validateTokenAndGetPrincipal(String jwtToken);
}

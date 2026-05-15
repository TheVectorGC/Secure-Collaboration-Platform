package dev.cryptoservice.service;

import java.util.Map;

public interface JwtTokenService {
    boolean validateToken(String token);

    String extractUsername(String token);

    Map<String, Object> extractClaims(String token);
}

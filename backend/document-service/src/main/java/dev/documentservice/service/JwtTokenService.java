package dev.documentservice.service;

import java.util.Map;

public interface JwtTokenService {
    boolean validateToken(String token);

    Map<String, Object> extractClaims(String token);
}

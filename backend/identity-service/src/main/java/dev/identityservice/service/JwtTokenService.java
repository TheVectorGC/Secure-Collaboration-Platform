package dev.identityservice.service;

import dev.identityservice.model.entity.AccountEntity;
import java.time.OffsetDateTime;
import java.util.Map;
import org.springframework.security.core.userdetails.UserDetails;

public interface JwtTokenService {
    String generateAccessToken(AccountEntity accountEntity, OffsetDateTime expiresAt);
    boolean validateToken(String token, UserDetails userDetails);
    String extractUsername(String token);
    Map<String, Object> extractClaims(String token);
}

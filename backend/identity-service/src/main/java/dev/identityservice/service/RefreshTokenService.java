package dev.identityservice.service;

import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.model.entity.AuthSessionEntity;
import java.time.OffsetDateTime;
import java.util.UUID;

public interface RefreshTokenService {
    AuthSessionEntity createSession(
            AccountEntity accountEntity,
            UUID deviceId,
            String refreshToken,
            OffsetDateTime expiresAt
    );

    AuthSessionEntity rotateSession(
            AuthSessionEntity currentSession,
            String newRefreshToken,
            OffsetDateTime expiresAt
    );

    String generateRefreshToken();

    String hashRefreshToken(String refreshToken);
}
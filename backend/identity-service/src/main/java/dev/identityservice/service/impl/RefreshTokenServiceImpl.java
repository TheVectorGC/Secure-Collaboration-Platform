package dev.identityservice.service.impl;

import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.model.entity.AuthSessionEntity;
import dev.identityservice.model.enumeration.AuthSessionStatus;
import dev.identityservice.repository.AuthSessionRepository;
import dev.identityservice.service.RefreshTokenService;
import dev.identityservice.util.HashUtils;
import dev.identityservice.util.SecureTokenGenerator;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RefreshTokenServiceImpl implements RefreshTokenService {
    private final AuthSessionRepository authSessionRepository;

    @Override
    @Transactional
    public AuthSessionEntity createSession(
            AccountEntity accountEntity,
            UUID deviceId,
            String refreshToken,
            OffsetDateTime expiresAt
    ) {
        revokeActiveDeviceSessions(accountEntity.getId(), deviceId);

        OffsetDateTime now = OffsetDateTime.now();

        AuthSessionEntity authSessionEntity = AuthSessionEntity.builder()
                .accountId(accountEntity.getId())
                .deviceId(deviceId)
                .refreshTokenHash(hashRefreshToken(refreshToken))
                .tokenFamilyId(UUID.randomUUID())
                .status(AuthSessionStatus.ACTIVE)
                .issuedAt(now)
                .lastUsedAt(now)
                .expiresAt(expiresAt)
                .build();

        return authSessionRepository.save(authSessionEntity);
    }

    @Override
    @Transactional
    public AuthSessionEntity rotateSession(
            AuthSessionEntity currentSession,
            String newRefreshToken,
            OffsetDateTime expiresAt
    ) {
        OffsetDateTime now = OffsetDateTime.now();

        AuthSessionEntity newSession = AuthSessionEntity.builder()
                .accountId(currentSession.getAccountId())
                .deviceId(currentSession.getDeviceId())
                .refreshTokenHash(hashRefreshToken(newRefreshToken))
                .tokenFamilyId(currentSession.getTokenFamilyId())
                .status(AuthSessionStatus.ACTIVE)
                .issuedAt(now)
                .lastUsedAt(now)
                .expiresAt(expiresAt)
                .build();

        AuthSessionEntity savedNewSession = authSessionRepository.save(newSession);

        currentSession.setStatus(AuthSessionStatus.ROTATED);
        currentSession.setLastUsedAt(now);
        currentSession.setRotatedAt(now);
        currentSession.setReplacedBySessionId(savedNewSession.getId());

        authSessionRepository.save(currentSession);

        return savedNewSession;
    }

    @Override
    public String generateRefreshToken() {
        return SecureTokenGenerator.generateToken();
    }

    @Override
    public String hashRefreshToken(String refreshToken) {
        return HashUtils.sha256Hex(refreshToken);
    }

    private void revokeActiveDeviceSessions(UUID accountId, UUID deviceId) {
        List<AuthSessionEntity> activeSessions = authSessionRepository.findByAccountIdAndDeviceIdAndStatus(
                accountId,
                deviceId,
                AuthSessionStatus.ACTIVE
        );

        activeSessions.forEach(authSessionEntity -> authSessionEntity.setStatus(AuthSessionStatus.REVOKED));
        authSessionRepository.saveAll(activeSessions);
    }
}
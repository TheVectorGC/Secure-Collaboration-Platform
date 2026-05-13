package dev.identityservice.repository;

import dev.identityservice.model.entity.AuthSessionEntity;
import dev.identityservice.model.enumeration.AuthSessionStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuthSessionRepository extends JpaRepository<AuthSessionEntity, UUID> {
    Optional<AuthSessionEntity> findByRefreshTokenHash(String refreshTokenHash);

    List<AuthSessionEntity> findByAccountIdAndDeviceIdAndStatus(
            UUID accountId,
            UUID deviceId,
            AuthSessionStatus status
    );

    List<AuthSessionEntity> findByDeviceIdAndStatus(
            UUID deviceId,
            AuthSessionStatus status
    );

    List<AuthSessionEntity> findByAccountIdAndStatus(
            UUID accountId,
            AuthSessionStatus status
    );
}
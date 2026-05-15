package dev.identityservice.repository;

import dev.identityservice.model.entity.DeviceEntity;
import dev.identityservice.model.enumeration.DeviceStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeviceRepository extends JpaRepository<DeviceEntity, UUID> {
    Optional<DeviceEntity> findByIdAndAccountId(UUID deviceId, UUID accountId);

    Optional<DeviceEntity> findByAccountIdAndClientInstallationIdAndStatus(
            UUID accountId,
            String clientInstallationId,
            DeviceStatus status
    );

    List<DeviceEntity> findByAccountId(UUID accountId);

    List<DeviceEntity> findByAccountIdAndStatus(UUID accountId, DeviceStatus status);

    boolean existsByIdAndAccountId(UUID deviceId, UUID accountId);
}
package dev.cryptoservice.repository;

import dev.cryptoservice.model.entity.DeviceSignedPreKeyEntity;
import dev.cryptoservice.model.enumeration.SignedPreKeyStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeviceSignedPreKeyRepository extends JpaRepository<DeviceSignedPreKeyEntity, UUID> {
    boolean existsByDeviceIdAndKeyId(UUID deviceId, Integer keyId);

    Optional<DeviceSignedPreKeyEntity> findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(
        UUID deviceId,
        SignedPreKeyStatus status
    );

    List<DeviceSignedPreKeyEntity> findByDeviceIdAndStatus(UUID deviceId, SignedPreKeyStatus status);
}

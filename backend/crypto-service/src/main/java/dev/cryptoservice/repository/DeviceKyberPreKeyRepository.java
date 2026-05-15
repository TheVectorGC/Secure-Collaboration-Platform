package dev.cryptoservice.repository;

import dev.cryptoservice.model.entity.DeviceKyberPreKeyEntity;
import dev.cryptoservice.model.enumeration.KyberPreKeyStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeviceKyberPreKeyRepository extends JpaRepository<DeviceKyberPreKeyEntity, UUID> {
    boolean existsByDeviceIdAndKeyId(UUID deviceId, Integer keyId);

    Optional<DeviceKyberPreKeyEntity> findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(
        UUID deviceId,
        KyberPreKeyStatus status
    );

    List<DeviceKyberPreKeyEntity> findByDeviceIdAndStatus(UUID deviceId, KyberPreKeyStatus status);
}

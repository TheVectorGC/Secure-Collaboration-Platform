package dev.cryptoservice.repository;

import dev.cryptoservice.model.entity.DeviceIdentityKeyEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeviceIdentityKeyRepository extends JpaRepository<DeviceIdentityKeyEntity, UUID> {
    boolean existsByFingerprint(String fingerprint);
}

package dev.cryptoservice.repository;

import dev.cryptoservice.model.entity.DeviceOneTimePreKeyEntity;
import dev.cryptoservice.model.enumeration.OneTimePreKeyStatus;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface DeviceOneTimePreKeyRepository extends JpaRepository<DeviceOneTimePreKeyEntity, UUID> {
    boolean existsByDeviceIdAndKeyId(UUID deviceId, Integer keyId);

    long countByDeviceIdAndStatus(UUID deviceId, OneTimePreKeyStatus status);

    @Query(
        value = """
            select *
            from device_one_time_prekeys
            where device_id = :deviceId
              and status = 'AVAILABLE'
            order by created_at asc
            limit 1
            for update
            """,
        nativeQuery = true
    )
    Optional<DeviceOneTimePreKeyEntity> findFirstAvailableForUpdate(@Param("deviceId") UUID deviceId);
}

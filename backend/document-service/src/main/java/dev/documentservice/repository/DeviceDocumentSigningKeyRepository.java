package dev.documentservice.repository;

import dev.documentservice.model.entity.DeviceDocumentSigningKeyEntity;
import dev.documentservice.model.enumeration.DocumentSigningKeyStatus;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeviceDocumentSigningKeyRepository extends JpaRepository<DeviceDocumentSigningKeyEntity, UUID> {
    Optional<DeviceDocumentSigningKeyEntity> findByFingerprintAndStatus(String fingerprint, DocumentSigningKeyStatus status);

    Optional<DeviceDocumentSigningKeyEntity> findByAccountIdAndDeviceIdAndFingerprintAndStatus(
        UUID accountId,
        UUID deviceId,
        String fingerprint,
        DocumentSigningKeyStatus status
    );
}

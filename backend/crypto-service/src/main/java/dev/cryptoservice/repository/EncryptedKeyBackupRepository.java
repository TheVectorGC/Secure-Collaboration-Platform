package dev.cryptoservice.repository;

import dev.cryptoservice.model.entity.EncryptedKeyBackupEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EncryptedKeyBackupRepository extends JpaRepository<EncryptedKeyBackupEntity, UUID> {
}

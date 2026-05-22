package dev.cryptoservice.repository;

import dev.cryptoservice.model.entity.AccountBackupProfileEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountBackupProfileRepository extends JpaRepository<AccountBackupProfileEntity, UUID> {
}

package dev.messagingservice.repository;

import dev.messagingservice.model.entity.AccountBlockProjectionEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AccountBlockProjectionRepository extends JpaRepository<AccountBlockProjectionEntity, UUID> {
    boolean existsByBlockerAccountIdAndBlockedAccountId(UUID blockerAccountId, UUID blockedAccountId);

    Optional<AccountBlockProjectionEntity> findByBlockerAccountIdAndBlockedAccountId(UUID blockerAccountId, UUID blockedAccountId);
}

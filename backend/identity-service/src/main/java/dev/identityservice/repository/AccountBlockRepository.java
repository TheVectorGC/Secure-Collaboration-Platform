package dev.identityservice.repository;

import dev.identityservice.model.entity.AccountBlockEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AccountBlockRepository extends JpaRepository<AccountBlockEntity, UUID> {
    boolean existsByBlockerAccountIdAndBlockedAccountId(UUID blockerAccountId, UUID blockedAccountId);

    Optional<AccountBlockEntity> findByBlockerAccountIdAndBlockedAccountId(UUID blockerAccountId, UUID blockedAccountId);

    List<AccountBlockEntity> findByBlockerAccountId(UUID blockerAccountId);
}

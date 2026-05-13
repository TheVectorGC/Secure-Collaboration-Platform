package dev.identityservice.repository;

import dev.identityservice.model.entity.AccountRegistrationEntity;
import dev.identityservice.model.enumeration.RegistrationStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AccountRegistrationRepository extends JpaRepository<AccountRegistrationEntity, UUID> {
    Optional<AccountRegistrationEntity> findByRegistrationTokenHash(String registrationTokenHash);
    boolean existsByUsernameAndStatusIn(String username, List<RegistrationStatus> statuses);
    boolean existsByEmailAndStatusIn(String email, List<RegistrationStatus> statuses);
}

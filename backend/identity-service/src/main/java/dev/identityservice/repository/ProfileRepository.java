package dev.identityservice.repository;

import dev.identityservice.model.entity.ProfileEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProfileRepository extends JpaRepository<ProfileEntity, UUID> {
    List<ProfileEntity> findByAccountIdIn(Collection<UUID> accountIds);

    List<ProfileEntity> findTop20ByFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCaseOrMiddleNameContainingIgnoreCase(
            String firstName,
            String lastName,
            String middleName
    );
}
package dev.identityservice.model.entity;

import dev.identityservice.model.enumeration.RegistrationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "account_registrations")
public class AccountRegistrationEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    UUID id;

    @Column(nullable = false, unique = true, length = 32)
    String username;

    @Column(nullable = false, unique = true, length = 320)
    String email;

    @Column(name = "first_name", nullable = false, length = 100)
    String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    String lastName;

    @Column(name = "middle_name", length = 100)
    String middleName;

    @Column(name = "registration_token_hash", nullable = false)
    String registrationTokenHash;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    RegistrationStatus status;

    @Column(name = "expires_at", nullable = false)
    OffsetDateTime expiresAt;

    @Column(name = "created_at", nullable = false)
    OffsetDateTime createdAt;

    @Column(name = "completed_at")
    OffsetDateTime completedAt;
}

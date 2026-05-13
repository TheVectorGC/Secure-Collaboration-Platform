package dev.identityservice.model.entity;

import dev.identityservice.model.enumeration.AccountRole;
import dev.identityservice.model.enumeration.AccountStatus;
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
@Table(name = "accounts")
public class AccountEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    UUID id;

    @Column(nullable = false, unique = true, length = 32)
    String username;

    @Column(nullable = false, unique = true, length = 320)
    String email;

    @Column(name = "password_hash", nullable = false)
    String passwordHash;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    AccountStatus status;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    AccountRole role;

    @Column(name = "last_login_at")
    OffsetDateTime lastLoginAt;

    @Column(name = "created_at", nullable = false)
    OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    OffsetDateTime updatedAt;
}

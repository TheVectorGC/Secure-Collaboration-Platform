package dev.cryptoservice.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "device_identity_keys")
public class DeviceIdentityKeyEntity {
    @Id
    @Column(name = "device_id")
    private UUID deviceId;

    @Column(name = "public_key", nullable = false, columnDefinition = "TEXT")
    private String publicKey;

    @Column(nullable = false, unique = true, length = 128)
    private String fingerprint;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}

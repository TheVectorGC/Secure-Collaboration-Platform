package dev.identityservice.model.entity;

import dev.identityservice.model.enumeration.DevicePlatform;
import dev.identityservice.model.enumeration.DeviceStatus;
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
@Table(name = "devices")
public class DeviceEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "device_name", nullable = false, length = 100)
    private String deviceName;

    @Column(name = "client_installation_id", length = 64)
    private String clientInstallationId;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private DevicePlatform platform;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private DeviceStatus status;

    @Column(name = "client_version", length = 50)
    private String clientVersion;

    @Column(name = "os_name", length = 120)
    private String osName;

    @Column(name = "os_version", length = 120)
    private String osVersion;

    @Column(name = "architecture", length = 64)
    private String architecture;

    @Column(name = "hostname", length = 120)
    private String hostname;

    @Column(name = "device_fingerprint", length = 128)
    private String deviceFingerprint;

    @Column(name = "last_seen_at")
    private OffsetDateTime lastSeenAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}

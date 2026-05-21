package dev.documentservice.model.entity;

import dev.documentservice.model.enumeration.DocumentObserverRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "document_observers")
public class DocumentObserverEntity {
    @Id
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "observer_account_id", nullable = false)
    private UUID observerAccountId;

    @Column(name = "role", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private DocumentObserverRole role;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}

package dev.documentservice.model.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record AddDocumentObserversRequestDto(
    @NotEmpty(message = "At least one observer account ID is required.")
    List<@NotNull(message = "Observer account ID is required.") UUID> observerAccountIds) {}

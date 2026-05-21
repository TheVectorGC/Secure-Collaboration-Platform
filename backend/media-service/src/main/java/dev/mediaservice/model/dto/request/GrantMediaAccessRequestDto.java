package dev.mediaservice.model.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record GrantMediaAccessRequestDto(
    @NotEmpty(message = "At least one account ID is required.")
    List<@NotNull(message = "Account ID is required.") UUID> accountIds) {}

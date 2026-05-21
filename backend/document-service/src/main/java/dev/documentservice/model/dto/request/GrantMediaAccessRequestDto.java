package dev.documentservice.model.dto.request;

import java.util.List;
import java.util.UUID;

public record GrantMediaAccessRequestDto(List<UUID> accountIds) {}

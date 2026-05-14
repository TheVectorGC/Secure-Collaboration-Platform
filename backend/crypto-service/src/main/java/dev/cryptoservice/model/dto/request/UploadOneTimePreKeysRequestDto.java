package dev.cryptoservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;

@Schema(description = "Request DTO for uploading one-time prekeys.")
public record UploadOneTimePreKeysRequestDto(
    @Valid
    @NotEmpty(message = "Prekey list can't be empty.")
    @Size(max = 500, message = "One request can't contain more than 500 prekeys.")
    @Schema(description = "One-time prekeys to upload.")
    List<OneTimePreKeyRequestDto> preKeys,

    @Schema(description = "Optional one-time prekey expiration datetime.")
    OffsetDateTime expiresAt
) {}

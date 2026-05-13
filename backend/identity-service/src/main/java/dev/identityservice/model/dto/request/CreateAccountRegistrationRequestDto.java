package dev.identityservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;

@Schema(description = "Request DTO for creating controlled account registration")
public record CreateAccountRegistrationRequestDto(
    @NotBlank(message = "Username can't be empty.")
    @Size(max = 32, message = "Username length must be <= 32.")
    @Schema(description = "Reserved username", example = "ivan.ivanov")
    String username,

    @Email(message = "Email must be valid.")
    @NotBlank(message = "Email can't be empty.")
    @Size(max = 320, message = "Email length must be <= 320.")
    @Schema(description = "Reserved corporate email", example = "ivan.ivanov@company.local")
    String email,

    @NotBlank(message = "First name can't be empty.")
    @Size(max = 100, message = "First name length must be <= 100.")
    @Schema(description = "First name", example = "Ivan")
    String firstName,

    @NotBlank(message = "Last name can't be empty.")
    @Size(max = 100, message = "Last name length must be <= 100.")
    @Schema(description = "Last name", example = "Ivanov")
    String lastName,

    @Size(max = 100, message = "Middle name length must be <= 100.")
    @Schema(description = "Middle name", example = "Ivanovich", nullable = true)
    String middleName,

    @Future(message = "Expiration date must be in the future.")
    @NotNull(message = "Expiration date can't be empty.")
    @Schema(description = "Invite expiration datetime", example = "2026-05-20T12:00:00+03:00")
    OffsetDateTime expiresAt
) {}

package dev.identityservice.model.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Request DTO for completing controlled registration")
public record CompleteRegistrationRequestDto(
    @NotBlank(message = "Registration token can't be empty.")
    @Schema(description = "Raw invite token received by employee")
    String registrationToken,

    @NotBlank(message = "Password can't be empty.")
    @Size(min = 12, max = 128, message = "Password length must be between 12 and 128.")
    @Schema(description = "New account password", example = "StrongPassword123!")
    String password,

    @NotBlank(message = "Password confirmation can't be empty.")
    @Schema(description = "Password confirmation", example = "StrongPassword123!")
    String passwordConfirmation
) {}

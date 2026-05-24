package dev.messagingservice.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SetMessageReactionRequestDto(
    @NotBlank
    @Size(max = 16)
    String emoji
) {}

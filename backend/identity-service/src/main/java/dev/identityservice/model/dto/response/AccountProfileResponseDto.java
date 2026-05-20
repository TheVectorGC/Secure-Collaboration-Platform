package dev.identityservice.model.dto.response;

import dev.identityservice.model.enumeration.AccountStatus;
import dev.identityservice.model.enumeration.AvatarType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Response DTO representing corporate directory profile")
public record AccountProfileResponseDto(
    @Schema(description = "Account ID")
    UUID accountId,

    @Schema(description = "Username")
    String username,

    @Schema(description = "Email")
    String email,

    @Schema(description = "First name")
    String firstName,

    @Schema(description = "Last name")
    String lastName,

    @Schema(description = "Middle name")
    String middleName,

    @Schema(description = "Account status")
    AccountStatus status,

    @Schema(description = "Avatar type")
    AvatarType avatarType,

    @Schema(description = "Avatar file ID")
    UUID avatarFileId,

    @Schema(description = "Compressed avatar data URL")
    String avatarDataUrl
) {}

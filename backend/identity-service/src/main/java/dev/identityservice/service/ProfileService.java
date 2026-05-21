package dev.identityservice.service;

import dev.identityservice.model.dto.request.UpdateProfileAvatarRequestDto;
import dev.identityservice.model.dto.response.AccountProfileResponseDto;
import java.util.List;
import java.util.UUID;

public interface ProfileService {
    AccountProfileResponseDto getCurrentProfile(String username);

    AccountProfileResponseDto updateCurrentProfileAvatar(String username, UpdateProfileAvatarRequestDto requestDto);

    List<AccountProfileResponseDto> searchProfiles(String query);

    List<AccountProfileResponseDto> getProfilesByAccountIds(List<UUID> accountIds);
}

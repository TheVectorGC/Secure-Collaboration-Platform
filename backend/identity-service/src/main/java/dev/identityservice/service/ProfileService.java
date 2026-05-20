package dev.identityservice.service;

import dev.identityservice.model.dto.request.UpdateProfileAvatarRequestDto;
import dev.identityservice.model.dto.response.AccountProfileResponseDto;
import java.util.List;

public interface ProfileService {
    AccountProfileResponseDto getCurrentProfile(String username);

    AccountProfileResponseDto updateCurrentProfileAvatar(String username, UpdateProfileAvatarRequestDto requestDto);

    List<AccountProfileResponseDto> searchProfiles(String query);
}

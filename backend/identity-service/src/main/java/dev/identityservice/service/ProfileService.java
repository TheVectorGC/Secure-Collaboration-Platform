package dev.identityservice.service;

import dev.identityservice.model.dto.response.AccountProfileResponseDto;
import java.util.List;

public interface ProfileService {
    AccountProfileResponseDto getCurrentProfile(String username);
    List<AccountProfileResponseDto> searchProfiles(String query);
}

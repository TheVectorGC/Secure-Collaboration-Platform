package dev.identityservice.service;

import dev.identityservice.model.dto.request.CompleteRegistrationRequestDto;
import dev.identityservice.model.dto.request.LoginRequestDto;
import dev.identityservice.model.dto.request.LogoutRequestDto;
import dev.identityservice.model.dto.request.RefreshTokenRequestDto;
import dev.identityservice.model.dto.response.AuthenticationResponseDto;

public interface AuthService {
    void completeRegistration(CompleteRegistrationRequestDto completeRegistrationRequestDto);

    AuthenticationResponseDto login(LoginRequestDto loginRequestDto);

    AuthenticationResponseDto refresh(RefreshTokenRequestDto refreshTokenRequestDto);

    void logout(LogoutRequestDto logoutRequestDto);
}
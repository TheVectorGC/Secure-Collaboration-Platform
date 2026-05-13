package dev.identityservice.controller;

import dev.identityservice.model.dto.request.CompleteRegistrationRequestDto;
import dev.identityservice.model.dto.request.LoginRequestDto;
import dev.identityservice.model.dto.request.LogoutRequestDto;
import dev.identityservice.model.dto.request.RefreshTokenRequestDto;
import dev.identityservice.model.dto.response.AuthenticationResponseDto;
import dev.identityservice.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "APIs for account activation, login and token refresh")
public class AuthController {
    private final AuthService authService;

    @Operation(summary = "Complete invite registration")
    @PostMapping("/complete-registration")
    public ResponseEntity<Void> completeRegistration(@Valid @RequestBody CompleteRegistrationRequestDto completeRegistrationRequestDto) {
        authService.completeRegistration(completeRegistrationRequestDto);
        return new ResponseEntity<>(HttpStatus.CREATED);
    }

    @Operation(summary = "Login by username or email")
    @PostMapping("/login")
    public ResponseEntity<AuthenticationResponseDto> login(@Valid @RequestBody LoginRequestDto loginRequestDto) {
        log.info("Authentication request for login: {}.", loginRequestDto.login());
        return ResponseEntity.ok(authService.login(loginRequestDto));
    }

    @Operation(summary = "Refresh access token")
    @PostMapping("/refresh")
    public ResponseEntity<AuthenticationResponseDto> refresh(@Valid @RequestBody RefreshTokenRequestDto refreshTokenRequestDto) {
        return ResponseEntity.ok(authService.refresh(refreshTokenRequestDto));
    }

    @Operation(summary = "Logout by refresh token")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody LogoutRequestDto logoutRequestDto) {
        authService.logout(logoutRequestDto);
        return new ResponseEntity<>(HttpStatus.OK);
    }
}
package dev.identityservice.service.impl;

import dev.identityservice.properties.JwtProperties;
import dev.identityservice.properties.RefreshTokenProperties;
import dev.identityservice.util.StringNormalizer;
import dev.identityservice.exception.AccountBlockedException;
import dev.identityservice.exception.AccountNotFoundException;
import dev.identityservice.exception.DeviceNotFoundException;
import dev.identityservice.exception.DeviceRevokedException;
import dev.identityservice.exception.InvalidRefreshTokenException;
import dev.identityservice.exception.InvalidRegistrationTokenException;
import dev.identityservice.exception.PasswordConfirmationMismatchException;
import dev.identityservice.exception.RegistrationAlreadyCompletedException;
import dev.identityservice.exception.RegistrationExpiredException;
import dev.identityservice.exception.RegistrationNotFoundException;
import dev.identityservice.model.dto.request.CompleteRegistrationRequestDto;
import dev.identityservice.model.dto.request.LoginRequestDto;
import dev.identityservice.model.dto.request.LogoutRequestDto;
import dev.identityservice.model.dto.request.RefreshTokenRequestDto;
import dev.identityservice.model.dto.response.AuthenticationResponseDto;
import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.model.entity.AccountRegistrationEntity;
import dev.identityservice.model.entity.AuthSessionEntity;
import dev.identityservice.model.entity.DeviceEntity;
import dev.identityservice.model.entity.ProfileEntity;
import dev.identityservice.model.enumeration.AccountRole;
import dev.identityservice.model.enumeration.AccountStatus;
import dev.identityservice.model.enumeration.AuthSessionStatus;
import dev.identityservice.model.enumeration.AvatarType;
import dev.identityservice.model.enumeration.DeviceStatus;
import dev.identityservice.model.enumeration.RegistrationStatus;
import dev.identityservice.repository.AccountRegistrationRepository;
import dev.identityservice.repository.AccountRepository;
import dev.identityservice.repository.AuthSessionRepository;
import dev.identityservice.repository.DeviceRepository;
import dev.identityservice.repository.ProfileRepository;
import dev.identityservice.service.AuthService;
import dev.identityservice.service.DeviceService;
import dev.identityservice.service.JwtTokenService;
import dev.identityservice.service.RefreshTokenService;
import dev.identityservice.util.HashUtils;
import java.time.OffsetDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private static final String TOKEN_TYPE = "Bearer";

    private final AccountRepository accountRepository;
    private final ProfileRepository profileRepository;
    private final AccountRegistrationRepository accountRegistrationRepository;
    private final AuthSessionRepository authSessionRepository;
    private final DeviceRepository deviceRepository;
    private final RefreshTokenService refreshTokenService;
    private final DeviceService deviceService;
    private final JwtTokenService jwtTokenService;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;
    private final JwtProperties jwtProperties;
    private final RefreshTokenProperties refreshTokenProperties;

    @Override
    @Transactional
    public void completeRegistration(CompleteRegistrationRequestDto completeRegistrationRequestDto) {
        log.info("Completing account registration.");

        validatePasswordConfirmation(completeRegistrationRequestDto);

        String registrationTokenHash = HashUtils.sha256Hex(completeRegistrationRequestDto.registrationToken());

        AccountRegistrationEntity accountRegistrationEntity = accountRegistrationRepository
                .findByRegistrationTokenHash(registrationTokenHash)
                .orElseThrow(() -> {
                    log.warn("Registration token is invalid.");
                    return new InvalidRegistrationTokenException("Registration token is invalid.");
                });

        validateRegistration(accountRegistrationEntity);

        OffsetDateTime now = OffsetDateTime.now();

        AccountEntity accountEntity = AccountEntity.builder()
                .username(StringNormalizer.trimToNull(accountRegistrationEntity.getUsername()))
                .email(StringNormalizer.normalizeEmail(accountRegistrationEntity.getEmail()))
                .passwordHash(passwordEncoder.encode(completeRegistrationRequestDto.password()))
                .status(AccountStatus.ACTIVE)
                .role(AccountRole.USER)
                .createdAt(now)
                .updatedAt(now)
                .build();

        AccountEntity savedAccountEntity = accountRepository.save(accountEntity);

        ProfileEntity profileEntity = ProfileEntity.builder()
                .accountId(savedAccountEntity.getId())
                .firstName(StringNormalizer.trimToNull(accountRegistrationEntity.getFirstName()))
                .lastName(StringNormalizer.trimToNull(accountRegistrationEntity.getLastName()))
                .middleName(StringNormalizer.trimToNull(accountRegistrationEntity.getMiddleName()))
                .avatarType(AvatarType.AUTO)
                .createdAt(now)
                .updatedAt(now)
                .build();

        profileRepository.save(profileEntity);

        accountRegistrationEntity.setStatus(RegistrationStatus.COMPLETED);
        accountRegistrationEntity.setCompletedAt(now);

        accountRegistrationRepository.save(accountRegistrationEntity);

        log.info("Account registration completed successfully for username: {}.", savedAccountEntity.getUsername());
    }

    @Override
    @Transactional
    public AuthenticationResponseDto login(LoginRequestDto loginRequestDto) {
        log.info("Login attempt for: {}.", StringNormalizer.trimToNull(loginRequestDto.login()));

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        StringNormalizer.trimToNull(loginRequestDto.login()),
                        loginRequestDto.password()
                )
        );

        AccountEntity accountEntity = findAccountByLogin(StringNormalizer.trimToNull(loginRequestDto.login()));
        validateAccountIsActive(accountEntity);

        OffsetDateTime now = OffsetDateTime.now();

        accountEntity.setLastLoginAt(now);
        accountEntity.setUpdatedAt(now);
        accountRepository.save(accountEntity);

        DeviceEntity deviceEntity = deviceService.resolveLoginDevice(accountEntity, loginRequestDto);

        OffsetDateTime accessTokenExpiresAt = now.plus(jwtProperties.accessTokenExpiration());
        OffsetDateTime refreshTokenExpiresAt = now.plus(refreshTokenProperties.expiration());

        String refreshToken = refreshTokenService.generateRefreshToken();

        AuthSessionEntity authSessionEntity = refreshTokenService.createSession(
                accountEntity,
                deviceEntity.getId(),
                refreshToken,
                refreshTokenExpiresAt
        );

        String accessToken = jwtTokenService.generateAccessToken(accountEntity, accessTokenExpiresAt);

        log.info(
                "Login completed successfully for username: {}, device ID: {}.",
                accountEntity.getUsername(),
                deviceEntity.getId()
        );

        return new AuthenticationResponseDto(
                accessToken,
                refreshToken,
                TOKEN_TYPE,
                accessTokenExpiresAt,
                authSessionEntity.getId(),
                deviceEntity.getId()
        );
    }

    @Override
    @Transactional
    public void logout(LogoutRequestDto logoutRequestDto) {
        log.info("Logout request received.");

        String refreshTokenHash = refreshTokenService.hashRefreshToken(logoutRequestDto.refreshToken());
        authSessionRepository.findByRefreshTokenHash(refreshTokenHash)
                .ifPresent(authSessionEntity -> {
                    if (authSessionEntity.getStatus() == AuthSessionStatus.ACTIVE) {
                        authSessionEntity.setStatus(AuthSessionStatus.REVOKED);
                        authSessionRepository.save(authSessionEntity);
                        log.info("Refresh session revoked successfully. Session ID: {}.", authSessionEntity.getId());
                    }
                });
    }

    @Override
    @Transactional
    public AuthenticationResponseDto refresh(RefreshTokenRequestDto refreshTokenRequestDto) {
        log.info("Refreshing authentication tokens.");

        String refreshTokenHash = refreshTokenService.hashRefreshToken(refreshTokenRequestDto.refreshToken());

        AuthSessionEntity authSessionEntity = authSessionRepository.findByRefreshTokenHash(refreshTokenHash)
                .orElseThrow(() -> {
                    log.warn("Refresh token was not found.");
                    return new InvalidRefreshTokenException("Refresh token is invalid.");
                });

        validateRefreshSession(authSessionEntity);

        AccountEntity accountEntity = accountRepository.findById(authSessionEntity.getAccountId())
                .orElseThrow(() -> {
                    log.warn("Account not found for refresh session: {}.", authSessionEntity.getId());
                    return new AccountNotFoundException("Account with ID '" + authSessionEntity.getAccountId() + "' not found.");
                });

        validateAccountIsActive(accountEntity);
        validateRefreshDevice(authSessionEntity);

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime accessTokenExpiresAt = now.plus(jwtProperties.accessTokenExpiration());
        OffsetDateTime refreshTokenExpiresAt = now.plus(refreshTokenProperties.expiration());

        String newRefreshToken = refreshTokenService.generateRefreshToken();

        AuthSessionEntity newAuthSessionEntity = refreshTokenService.rotateSession(
                authSessionEntity,
                newRefreshToken,
                refreshTokenExpiresAt
        );

        String accessToken = jwtTokenService.generateAccessToken(accountEntity, accessTokenExpiresAt);

        log.info(
                "Authentication tokens refreshed successfully for username: {}, device ID: {}.",
                accountEntity.getUsername(),
                authSessionEntity.getDeviceId()
        );

        return new AuthenticationResponseDto(
                accessToken,
                newRefreshToken,
                TOKEN_TYPE,
                accessTokenExpiresAt,
                newAuthSessionEntity.getId(),
                authSessionEntity.getDeviceId()
        );
    }

    private void validatePasswordConfirmation(CompleteRegistrationRequestDto completeRegistrationRequestDto) {
        if (!completeRegistrationRequestDto.password().equals(completeRegistrationRequestDto.passwordConfirmation())) {
            log.warn("Password confirmation mismatch during registration completion.");
            throw new PasswordConfirmationMismatchException("Password and password confirmation do not match.");
        }
    }

    private void validateRegistration(AccountRegistrationEntity accountRegistrationEntity) {
        if (accountRegistrationEntity.getStatus() == RegistrationStatus.COMPLETED) {
            log.warn("Registration has already been completed: {}.", accountRegistrationEntity.getId());
            throw new RegistrationAlreadyCompletedException("Registration has already been completed.");
        }

        if (accountRegistrationEntity.getStatus() != RegistrationStatus.PENDING) {
            log.warn("Registration is not pending: {}.", accountRegistrationEntity.getId());
            throw new RegistrationNotFoundException("Registration is not active.");
        }

        if (accountRegistrationEntity.getExpiresAt().isBefore(OffsetDateTime.now())) {
            accountRegistrationEntity.setStatus(RegistrationStatus.EXPIRED);
            accountRegistrationRepository.save(accountRegistrationEntity);

            log.warn("Registration has expired: {}.", accountRegistrationEntity.getId());
            throw new RegistrationExpiredException("Registration has expired.");
        }
    }

    private void validateRefreshSession(AuthSessionEntity authSessionEntity) {
        if (authSessionEntity.getStatus() != AuthSessionStatus.ACTIVE) {
            log.warn(
                    "Refresh session is not active. Session ID: {}, status: {}.",
                    authSessionEntity.getId(),
                    authSessionEntity.getStatus()
            );
            throw new InvalidRefreshTokenException("Refresh token is invalid.");
        }

        if (authSessionEntity.getExpiresAt().isBefore(OffsetDateTime.now())) {
            authSessionEntity.setStatus(AuthSessionStatus.EXPIRED);
            authSessionRepository.save(authSessionEntity);

            log.warn("Refresh session has expired: {}.", authSessionEntity.getId());
            throw new InvalidRefreshTokenException("Refresh token has expired.");
        }
    }

    private void validateRefreshDevice(AuthSessionEntity authSessionEntity) {
        DeviceEntity deviceEntity = deviceRepository.findByIdAndAccountId(
                        authSessionEntity.getDeviceId(),
                        authSessionEntity.getAccountId()
                )
                .orElseThrow(() -> {
                    log.warn(
                            "Device not found for refresh session. Device ID: {}, account ID: {}.",
                            authSessionEntity.getDeviceId(),
                            authSessionEntity.getAccountId()
                    );
                    return new DeviceNotFoundException("Device with ID '" + authSessionEntity.getDeviceId() + "' not found.");
                });

        if (deviceEntity.getStatus() == DeviceStatus.REVOKED) {
            authSessionEntity.setStatus(AuthSessionStatus.REVOKED);
            authSessionRepository.save(authSessionEntity);

            log.warn(
                    "Refresh attempt from revoked device. Device ID: {}, account ID: {}.",
                    deviceEntity.getId(),
                    deviceEntity.getAccountId()
            );
            throw new DeviceRevokedException("Device has been revoked.");
        }

        deviceEntity.setLastSeenAt(OffsetDateTime.now());
        deviceRepository.save(deviceEntity);
    }

    private void validateAccountIsActive(AccountEntity accountEntity) {
        if (accountEntity.getStatus() == AccountStatus.BLOCKED) {
            log.warn("Blocked account access attempt. Account ID: {}.", accountEntity.getId());
            throw new AccountBlockedException("Account is blocked.");
        }
    }

    private AccountEntity findAccountByLogin(String login) {
        if (login.contains("@")) {
            return accountRepository.findByEmail(login)
                    .orElseThrow(() -> {
                        log.warn("Account not found by email: {}.", login);
                        return new AccountNotFoundException("Account not found.");
                    });
        }

        return accountRepository.findByUsername(login)
                .orElseThrow(() -> {
                    log.warn("Account not found by username: {}.", login);
                    return new AccountNotFoundException("Account not found.");
                });
    }
}

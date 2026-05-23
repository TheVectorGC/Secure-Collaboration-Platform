package dev.identityservice.service.impl;

import dev.identityservice.util.StringNormalizer;
import dev.identityservice.exception.AccountAlreadyExistsException;
import dev.identityservice.exception.AccountNotFoundException;
import dev.identityservice.model.dto.request.CreateAccountRegistrationRequestDto;
import dev.identityservice.model.dto.response.AccountRegistrationResponseDto;
import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.model.entity.AccountRegistrationEntity;
import dev.identityservice.model.entity.AuthSessionEntity;
import dev.identityservice.model.entity.DeviceEntity;
import dev.identityservice.model.enumeration.AccountStatus;
import dev.identityservice.model.enumeration.AuthSessionStatus;
import dev.identityservice.model.enumeration.DeviceStatus;
import dev.identityservice.model.enumeration.RegistrationStatus;
import dev.identityservice.repository.AccountRegistrationRepository;
import dev.identityservice.repository.AccountRepository;
import dev.identityservice.repository.AuthSessionRepository;
import dev.identityservice.repository.DeviceRepository;
import dev.identityservice.service.AdminAccountService;
import dev.identityservice.util.HashUtils;
import dev.identityservice.util.SecureTokenGenerator;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAccountServiceImpl implements AdminAccountService {
    private static final List<RegistrationStatus> ACTIVE_REGISTRATION_STATUSES = List.of(RegistrationStatus.PENDING);

    private final AccountRepository accountRepository;
    private final AccountRegistrationRepository accountRegistrationRepository;
    private final DeviceRepository deviceRepository;
    private final AuthSessionRepository authSessionRepository;

    @Override
    @Transactional
    public AccountRegistrationResponseDto createAccountRegistration(CreateAccountRegistrationRequestDto createAccountRegistrationRequestDto) {
        log.info(
                "Creating account registration for username: {}, email: {}.",
                createAccountRegistrationRequestDto.username(),
                createAccountRegistrationRequestDto.email()
        );

        validateUniqueIdentity(createAccountRegistrationRequestDto.username(), createAccountRegistrationRequestDto.email());

        String registrationToken = SecureTokenGenerator.generateToken();

        AccountRegistrationEntity accountRegistrationEntity = AccountRegistrationEntity.builder()
                .username(StringNormalizer.trimToNull(createAccountRegistrationRequestDto.username()))
                .email(StringNormalizer.normalizeEmail(createAccountRegistrationRequestDto.email()))
                .firstName(StringNormalizer.trimToNull(createAccountRegistrationRequestDto.firstName()))
                .lastName(StringNormalizer.trimToNull(createAccountRegistrationRequestDto.lastName()))
                .middleName(StringNormalizer.trimToNull(createAccountRegistrationRequestDto.middleName()))
                .registrationTokenHash(HashUtils.sha256Hex(registrationToken))
                .status(RegistrationStatus.PENDING)
                .expiresAt(createAccountRegistrationRequestDto.expiresAt())
                .createdAt(OffsetDateTime.now())
                .build();

        AccountRegistrationEntity savedAccountRegistrationEntity = accountRegistrationRepository.save(accountRegistrationEntity);

        log.info("Account registration created with ID: {}.", savedAccountRegistrationEntity.getId());

        return new AccountRegistrationResponseDto(
                savedAccountRegistrationEntity.getId(),
                savedAccountRegistrationEntity.getUsername(),
                savedAccountRegistrationEntity.getEmail(),
                registrationToken,
                savedAccountRegistrationEntity.getExpiresAt()
        );
    }

    @Override
    @Transactional
    public void blockAccount(UUID accountId) {
        AccountEntity accountEntity = accountRepository.findById(accountId)
                .orElseThrow(() -> new AccountNotFoundException("Account with ID '" + accountId + "' not found."));

        accountEntity.setStatus(AccountStatus.BLOCKED);
        accountEntity.setUpdatedAt(OffsetDateTime.now());
        accountRepository.save(accountEntity);

        revokeAccountDevices(accountId);
        revokeAccountSessions(accountId);

        log.info("Account with ID: {} has been blocked.", accountId);
    }

    private void revokeAccountDevices(UUID accountId) {
        List<DeviceEntity> activeDevices = deviceRepository.findByAccountIdAndStatus(accountId, DeviceStatus.ACTIVE);

        activeDevices.forEach(deviceEntity -> deviceEntity.setStatus(DeviceStatus.REVOKED));
        deviceRepository.saveAll(activeDevices);
    }

    private void revokeAccountSessions(UUID accountId) {
        List<AuthSessionEntity> activeSessions = authSessionRepository.findByAccountIdAndStatus(
                accountId,
                AuthSessionStatus.ACTIVE
        );

        activeSessions.forEach(authSessionEntity -> authSessionEntity.setStatus(AuthSessionStatus.REVOKED));
        authSessionRepository.saveAll(activeSessions);
    }

    private void validateUniqueIdentity(String username, String email) {
        String normalizedEmail = StringNormalizer.normalizeEmail(email);
        String normalizedUsername = StringNormalizer.trimToNull(username);

        if (
                accountRepository.existsByUsername(normalizedUsername)
                        || accountRegistrationRepository.existsByUsernameAndStatusIn(normalizedUsername, ACTIVE_REGISTRATION_STATUSES)
        ) {
            throw new AccountAlreadyExistsException(
                    "Account with username '" + normalizedUsername + "' already exists or registration is pending."
            );
        }

        if (
                accountRepository.existsByEmail(normalizedEmail)
                        || accountRegistrationRepository.existsByEmailAndStatusIn(normalizedEmail, ACTIVE_REGISTRATION_STATUSES)
        ) {
            throw new AccountAlreadyExistsException(
                    "Account with email '" + normalizedEmail + "' already exists or registration is pending."
            );
        }
    }

}
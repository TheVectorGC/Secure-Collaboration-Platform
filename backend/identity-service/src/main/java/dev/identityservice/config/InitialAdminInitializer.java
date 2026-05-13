package dev.identityservice.config;

import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.model.entity.ProfileEntity;
import dev.identityservice.model.enumeration.AccountRole;
import dev.identityservice.model.enumeration.AccountStatus;
import dev.identityservice.model.enumeration.AvatarType;
import dev.identityservice.repository.AccountRepository;
import dev.identityservice.repository.ProfileRepository;
import java.time.OffsetDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class InitialAdminInitializer implements CommandLineRunner {
    private final InitialAdminProperties initialAdminProperties;
    private final AccountRepository accountRepository;
    private final ProfileRepository profileRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        if (!initialAdminProperties.enabled()) {
            return;
        }

        if (accountRepository.existsByUsername(initialAdminProperties.username())) {
            return;
        }

        OffsetDateTime now = OffsetDateTime.now();

        AccountEntity accountEntity = AccountEntity.builder()
                .username(initialAdminProperties.username())
                .email(initialAdminProperties.email().trim().toLowerCase())
                .passwordHash(passwordEncoder.encode(initialAdminProperties.password()))
                .status(AccountStatus.ACTIVE)
                .role(AccountRole.ADMIN)
                .createdAt(now)
                .updatedAt(now)
                .build();

        AccountEntity savedAccountEntity = accountRepository.save(accountEntity);

        ProfileEntity profileEntity = ProfileEntity.builder()
                .accountId(savedAccountEntity.getId())
                .firstName(initialAdminProperties.firstName())
                .lastName(initialAdminProperties.lastName())
                .avatarType(AvatarType.AUTO)
                .createdAt(now)
                .updatedAt(now)
                .build();

        profileRepository.save(profileEntity);

        log.info("Initial admin account created with ID: {}.", savedAccountEntity.getId());
    }
}
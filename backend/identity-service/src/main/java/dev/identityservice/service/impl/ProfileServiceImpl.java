package dev.identityservice.service.impl;

import dev.identityservice.exception.AccountNotFoundException;
import dev.identityservice.model.dto.response.AccountProfileResponseDto;
import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.model.entity.ProfileEntity;
import dev.identityservice.repository.AccountRepository;
import dev.identityservice.repository.ProfileRepository;
import dev.identityservice.service.MappingService;
import dev.identityservice.service.ProfileService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileServiceImpl implements ProfileService {
    private final AccountRepository accountRepository;
    private final ProfileRepository profileRepository;
    private final MappingService mappingService;

    @Override
    @Transactional(readOnly = true)
    public AccountProfileResponseDto getCurrentProfile(String username) {
        log.info("Fetching current profile for username: {}.", username);

        AccountEntity accountEntity = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AccountNotFoundException("Account with username '" + username + "' not found."));

        ProfileEntity profileEntity = profileRepository.findById(accountEntity.getId())
                .orElseThrow(() -> new AccountNotFoundException("Profile for account '" + accountEntity.getId() + "' not found."));

        return mappingService.mapToAccountProfileResponseDto(accountEntity, profileEntity);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AccountProfileResponseDto> searchProfiles(String query) {
        log.info("Searching profiles by query: {}.", query);

        String preparedQuery = prepareSearchQuery(query);

        if (preparedQuery == null) {
            return List.of();
        }

        Map<UUID, AccountEntity> accountById = new LinkedHashMap<>();
        Map<UUID, ProfileEntity> profileByAccountId = new LinkedHashMap<>();

        collectAccountsByUsernameOrEmail(preparedQuery, accountById);
        collectProfilesByFullName(preparedQuery, profileByAccountId);

        if (!accountById.isEmpty()) {
            List<ProfileEntity> profilesForFoundAccounts = profileRepository.findByAccountIdIn(accountById.keySet());
            profilesForFoundAccounts.forEach(profileEntity -> profileByAccountId.put(profileEntity.getAccountId(), profileEntity));
        }

        if (!profileByAccountId.isEmpty()) {
            List<UUID> missingAccountIds = profileByAccountId.keySet().stream()
                    .filter(accountId -> !accountById.containsKey(accountId))
                    .toList();

            accountRepository.findAllById(missingAccountIds)
                    .forEach(accountEntity -> accountById.put(accountEntity.getId(), accountEntity));
        }

        List<AccountProfileResponseDto> result = new ArrayList<>();

        profileByAccountId.forEach((accountId, profileEntity) -> {
            AccountEntity accountEntity = accountById.get(accountId);

            if (accountEntity != null) {
                result.add(mappingService.mapToAccountProfileResponseDto(accountEntity, profileEntity));
            }
        });

        log.info("Profiles found: {}.", result.size());

        return result.stream()
                .limit(20)
                .toList();
    }

    private void collectAccountsByUsernameOrEmail(
            String preparedQuery,
            Map<UUID, AccountEntity> accountById
    ) {
        accountRepository.findByUsername(preparedQuery)
                .ifPresent(accountEntity -> accountById.put(accountEntity.getId(), accountEntity));

        accountRepository.findByEmail(preparedQuery)
                .ifPresent(accountEntity -> accountById.put(accountEntity.getId(), accountEntity));
    }

    private void collectProfilesByFullName(
            String preparedQuery,
            Map<UUID, ProfileEntity> profileByAccountId
    ) {
        List<ProfileEntity> profiles = profileRepository
                .findTop20ByFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCaseOrMiddleNameContainingIgnoreCase(
                        preparedQuery,
                        preparedQuery,
                        preparedQuery
                );

        profiles.forEach(profileEntity -> profileByAccountId.put(profileEntity.getAccountId(), profileEntity));
    }

    private String prepareSearchQuery(String query) {
        if (query == null || query.trim().isEmpty()) {
            return null;
        }

        return query.trim();
    }
}
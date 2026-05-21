package dev.identityservice.service.impl;

import dev.identityservice.exception.AccountNotFoundException;
import dev.identityservice.model.dto.request.UpdateProfileAvatarRequestDto;
import dev.identityservice.model.dto.response.AccountProfileResponseDto;
import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.model.entity.ProfileEntity;
import dev.identityservice.model.enumeration.AvatarType;
import dev.identityservice.repository.AccountRepository;
import dev.identityservice.repository.ProfileRepository;
import dev.identityservice.service.MappingService;
import dev.identityservice.service.ProfileService;
import java.time.OffsetDateTime;
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
    private static final int MAX_AVATAR_DATA_URL_LENGTH = 700000;

    private final AccountRepository accountRepository;
    private final ProfileRepository profileRepository;
    private final MappingService mappingService;

    @Override
    @Transactional(readOnly = true)
    public AccountProfileResponseDto getCurrentProfile(String username) {
        log.info("Fetching current profile for username: {}.", username);
        AccountEntity accountEntity = findAccountByUsername(username);
        ProfileEntity profileEntity = findProfileByAccountId(accountEntity.getId());
        return mappingService.mapToAccountProfileResponseDto(accountEntity, profileEntity);
    }

    @Override
    @Transactional
    public AccountProfileResponseDto updateCurrentProfileAvatar(String username, UpdateProfileAvatarRequestDto requestDto) {
        log.info("Updating profile avatar for username: {}.", username);
        AccountEntity accountEntity = findAccountByUsername(username);
        ProfileEntity profileEntity = findProfileByAccountId(accountEntity.getId());
        String avatarDataUrl = normalizeAvatarDataUrl(requestDto.avatarDataUrl());

        if (avatarDataUrl == null) {
            profileEntity.setAvatarType(AvatarType.AUTO);
            profileEntity.setAvatarDataUrl(null);
        }
        else {
            profileEntity.setAvatarType(AvatarType.UPLOADED);
            profileEntity.setAvatarDataUrl(avatarDataUrl);
        }

        profileEntity.setUpdatedAt(OffsetDateTime.now());
        ProfileEntity savedProfileEntity = profileRepository.save(profileEntity);
        return mappingService.mapToAccountProfileResponseDto(accountEntity, savedProfileEntity);
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


    @Override
    @Transactional(readOnly = true)
    public List<AccountProfileResponseDto> getProfilesByAccountIds(List<UUID> accountIds) {
        if (accountIds == null || accountIds.isEmpty()) {
            return List.of();
        }

        List<UUID> uniqueAccountIds = accountIds.stream()
                .filter(accountId -> accountId != null)
                .distinct()
                .limit(500)
                .toList();

        if (uniqueAccountIds.isEmpty()) {
            return List.of();
        }

        Map<UUID, AccountEntity> accountById = new LinkedHashMap<>();
        accountRepository.findAllById(uniqueAccountIds)
                .forEach(accountEntity -> accountById.put(accountEntity.getId(), accountEntity));

        Map<UUID, ProfileEntity> profileByAccountId = new LinkedHashMap<>();
        profileRepository.findByAccountIdIn(uniqueAccountIds)
                .forEach(profileEntity -> profileByAccountId.put(profileEntity.getAccountId(), profileEntity));

        return uniqueAccountIds.stream()
                .map(accountId -> {
                    AccountEntity accountEntity = accountById.get(accountId);
                    ProfileEntity profileEntity = profileByAccountId.get(accountId);

                    if (accountEntity == null || profileEntity == null) {
                        return null;
                    }

                    return mappingService.mapToAccountProfileResponseDto(accountEntity, profileEntity);
                })
                .filter(profileResponseDto -> profileResponseDto != null)
                .toList();
    }

    private AccountEntity findAccountByUsername(String username) {
        return accountRepository.findByUsername(username)
                .orElseThrow(() -> new AccountNotFoundException("Account with username '" + username + "' not found."));
    }

    private ProfileEntity findProfileByAccountId(UUID accountId) {
        return profileRepository.findById(accountId)
                .orElseThrow(() -> new AccountNotFoundException("Profile for account '" + accountId + "' not found."));
    }

    private String normalizeAvatarDataUrl(String avatarDataUrl) {
        if (avatarDataUrl == null || avatarDataUrl.trim().isEmpty()) {
            return null;
        }

        String preparedAvatarDataUrl = avatarDataUrl.trim();

        if (!preparedAvatarDataUrl.startsWith("data:image/")) {
            throw new IllegalArgumentException("Avatar must be an image data URL.");
        }

        if (preparedAvatarDataUrl.length() > MAX_AVATAR_DATA_URL_LENGTH) {
            throw new IllegalArgumentException("Avatar data URL is too large.");
        }

        return preparedAvatarDataUrl;
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

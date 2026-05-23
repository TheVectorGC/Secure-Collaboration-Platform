package dev.identityservice.service.impl;

import dev.identityservice.exception.AccountNotFoundException;
import dev.identityservice.model.dto.response.AccountBlockResponseDto;
import dev.identityservice.model.dto.response.AccountBlockStatusResponseDto;
import dev.identityservice.model.entity.AccountBlockEntity;
import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.repository.AccountBlockRepository;
import dev.identityservice.repository.AccountRepository;
import dev.identityservice.service.AccountBlockService;
import dev.identityservice.service.event.IdentityOutboxService;
import dev.identityservice.service.mapper.AccountBlockMapper;
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
public class AccountBlockServiceImpl implements AccountBlockService {
    private final AccountRepository accountRepository;
    private final AccountBlockRepository accountBlockRepository;
    private final AccountBlockMapper accountBlockMapper;
    private final IdentityOutboxService identityOutboxService;

    @Override
    @Transactional
    public AccountBlockResponseDto blockAccount(String username, UUID blockedAccountId) {
        AccountEntity blockerAccount = findAccountByUsername(username);
        AccountEntity blockedAccount = findAccountById(blockedAccountId);

        if (blockerAccount.getId().equals(blockedAccount.getId())) {
            throw new IllegalArgumentException("Account cannot block itself.");
        }

        AccountBlockEntity accountBlockEntity = accountBlockRepository
                .findByBlockerAccountIdAndBlockedAccountId(blockerAccount.getId(), blockedAccount.getId())
                .orElseGet(() -> createBlockAndEvent(blockerAccount.getId(), blockedAccount.getId()));

        return accountBlockMapper.toResponseDto(accountBlockEntity);
    }

    @Override
    @Transactional
    public void unblockAccount(String username, UUID blockedAccountId) {
        AccountEntity blockerAccount = findAccountByUsername(username);
        AccountEntity blockedAccount = findAccountById(blockedAccountId);

        accountBlockRepository.findByBlockerAccountIdAndBlockedAccountId(blockerAccount.getId(), blockedAccount.getId())
                .ifPresent(accountBlockEntity -> {
                    accountBlockRepository.delete(accountBlockEntity);
                    identityOutboxService.enqueueAccountUnblocked(blockerAccount.getId(), blockedAccount.getId());
                    log.info("Account block removed. Blocker account ID: {}, blocked account ID: {}.", blockerAccount.getId(), blockedAccount.getId());
                });
    }

    @Override
    @Transactional(readOnly = true)
    public List<AccountBlockResponseDto> getCurrentAccountBlocks(String username) {
        AccountEntity blockerAccount = findAccountByUsername(username);
        return accountBlockRepository.findByBlockerAccountId(blockerAccount.getId()).stream()
                .map(accountBlockMapper::toResponseDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public AccountBlockStatusResponseDto getCurrentAccountBlockStatus(String username, UUID blockedAccountId) {
        AccountEntity blockerAccount = findAccountByUsername(username);
        boolean blocked = accountBlockRepository.existsByBlockerAccountIdAndBlockedAccountId(blockerAccount.getId(), blockedAccountId);
        return new AccountBlockStatusResponseDto(blockerAccount.getId(), blockedAccountId, blocked);
    }

    private AccountBlockEntity createBlockAndEvent(UUID blockerAccountId, UUID blockedAccountId) {
        AccountBlockEntity accountBlockEntity = AccountBlockEntity.builder()
                .blockerAccountId(blockerAccountId)
                .blockedAccountId(blockedAccountId)
                .createdAt(OffsetDateTime.now())
                .build();

        AccountBlockEntity savedAccountBlockEntity = accountBlockRepository.save(accountBlockEntity);
        identityOutboxService.enqueueAccountBlocked(blockerAccountId, blockedAccountId);
        log.info("Account block stored. Blocker account ID: {}, blocked account ID: {}.", blockerAccountId, blockedAccountId);
        return savedAccountBlockEntity;
    }

    private AccountEntity findAccountByUsername(String username) {
        return accountRepository.findByUsername(username)
                .orElseThrow(() -> new AccountNotFoundException("Account with username '" + username + "' not found."));
    }

    private AccountEntity findAccountById(UUID accountId) {
        return accountRepository.findById(accountId)
                .orElseThrow(() -> new AccountNotFoundException("Account with ID '" + accountId + "' not found."));
    }
}

package dev.messagingservice.service.block;

import dev.messagingservice.exception.AccountBlockedException;
import dev.messagingservice.model.entity.AccountBlockProjectionEntity;
import dev.messagingservice.repository.AccountBlockProjectionRepository;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AccountBlockServiceImpl implements AccountBlockService {
    private final AccountBlockProjectionRepository accountBlockProjectionRepository;

    @Override
    @Transactional(readOnly = true)
    public void ensureDirectMessagingAllowed(UUID firstAccountId, UUID secondAccountId) {
        if (isBlockedInEitherDirection(firstAccountId, secondAccountId)) {
            throw new AccountBlockedException("Direct messaging is not available because one account has blocked the other account.");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isBlockedInEitherDirection(UUID firstAccountId, UUID secondAccountId) {
        return accountBlockProjectionRepository.existsByBlockerAccountIdAndBlockedAccountId(firstAccountId, secondAccountId)
                || accountBlockProjectionRepository.existsByBlockerAccountIdAndBlockedAccountId(secondAccountId, firstAccountId);
    }

    @Override
    @Transactional
    public void applyAccountBlocked(UUID blockerAccountId, UUID blockedAccountId, OffsetDateTime occurredAt) {
        AccountBlockProjectionEntity existingProjection = accountBlockProjectionRepository
                .findByBlockerAccountIdAndBlockedAccountId(blockerAccountId, blockedAccountId)
                .orElse(null);

        if (existingProjection != null) {
            existingProjection.setUpdatedAt(occurredAt);
            accountBlockProjectionRepository.save(existingProjection);
            return;
        }

        AccountBlockProjectionEntity projectionEntity = AccountBlockProjectionEntity.builder()
                .blockerAccountId(blockerAccountId)
                .blockedAccountId(blockedAccountId)
                .createdAt(occurredAt)
                .updatedAt(occurredAt)
                .build();
        accountBlockProjectionRepository.save(projectionEntity);
        log.info("Account block projection stored. Blocker account ID: {}, blocked account ID: {}.", blockerAccountId, blockedAccountId);
    }

    @Override
    @Transactional
    public void applyAccountUnblocked(UUID blockerAccountId, UUID blockedAccountId) {
        accountBlockProjectionRepository
                .findByBlockerAccountIdAndBlockedAccountId(blockerAccountId, blockedAccountId)
                .ifPresent(projectionEntity -> {
                    accountBlockProjectionRepository.delete(projectionEntity);
                    log.info("Account block projection removed. Blocker account ID: {}, blocked account ID: {}.", blockerAccountId, blockedAccountId);
                });
    }
}

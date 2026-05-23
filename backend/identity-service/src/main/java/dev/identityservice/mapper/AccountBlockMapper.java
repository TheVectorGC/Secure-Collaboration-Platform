package dev.identityservice.mapper;

import dev.identityservice.model.dto.response.AccountBlockResponseDto;
import dev.identityservice.model.entity.AccountBlockEntity;
import org.springframework.stereotype.Component;

@Component
public class AccountBlockMapper {
    public AccountBlockResponseDto toResponseDto(AccountBlockEntity accountBlockEntity) {
        return new AccountBlockResponseDto(
                accountBlockEntity.getId(),
                accountBlockEntity.getBlockerAccountId(),
                accountBlockEntity.getBlockedAccountId(),
                accountBlockEntity.getCreatedAt()
        );
    }
}

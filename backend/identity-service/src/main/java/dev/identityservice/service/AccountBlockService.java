package dev.identityservice.service;

import dev.identityservice.model.dto.response.AccountBlockResponseDto;
import dev.identityservice.model.dto.response.AccountBlockStatusResponseDto;
import java.util.List;
import java.util.UUID;

public interface AccountBlockService {
    AccountBlockResponseDto blockAccount(String username, UUID blockedAccountId);

    void unblockAccount(String username, UUID blockedAccountId);

    List<AccountBlockResponseDto> getCurrentAccountBlocks(String username);

    AccountBlockStatusResponseDto getCurrentAccountBlockStatus(String username, UUID blockedAccountId);
}

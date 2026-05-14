package dev.messagingservice.service.impl;

import dev.messagingservice.exception.ChatAccessDeniedException;
import dev.messagingservice.security.AccountPrincipal;
import dev.messagingservice.service.CurrentAccountService;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class CurrentAccountServiceImpl implements CurrentAccountService {

    @Override
    public UUID getCurrentAccountId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !(authentication.getPrincipal() instanceof AccountPrincipal accountPrincipal)) {
            throw new ChatAccessDeniedException("Current account is not authenticated.");
        }

        return accountPrincipal.getAccountId();
    }
}

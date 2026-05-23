package dev.mediaservice.service.impl;

import dev.mediaservice.exception.MediaAccessDeniedException;
import dev.mediaservice.security.AccountPrincipal;
import dev.mediaservice.service.CurrentAccountService;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class CurrentAccountServiceImpl implements CurrentAccountService {
    @Override
    public UUID getCurrentAccountId() {
        return getCurrentPrincipal().getAccountId();
    }

    private AccountPrincipal getCurrentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AccountPrincipal accountPrincipal)) {
            throw new MediaAccessDeniedException("Authenticated account principal was not found.");
        }
        return accountPrincipal;
    }
}

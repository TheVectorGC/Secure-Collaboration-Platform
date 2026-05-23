package dev.documentservice.service.impl;

import dev.documentservice.security.AccountPrincipal;
import dev.documentservice.service.CurrentAccountService;
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
            throw new IllegalStateException("Authenticated account principal is not available.");
        }
        return accountPrincipal.getAccountId();
    }
}

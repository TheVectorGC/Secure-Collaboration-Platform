package dev.cryptoservice.service.impl;

import dev.cryptoservice.exception.DeviceAccessDeniedException;
import dev.cryptoservice.security.AccountPrincipal;
import dev.cryptoservice.service.CurrentAccountService;
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
            throw new DeviceAccessDeniedException("Current account is not authenticated.");
        }

        return accountPrincipal.getAccountId();
    }
}

package dev.identityservice.service.impl;

import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.repository.AccountRepository;
import dev.identityservice.security.AccountPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AccountDetailsServiceImpl implements UserDetailsService {
    private final AccountRepository accountRepository;

    @Override
    public AccountPrincipal loadUserByUsername(String login) throws UsernameNotFoundException {
        AccountEntity accountEntity = findAccountByLogin(login);

        return new AccountPrincipal(accountEntity);
    }

    private AccountEntity findAccountByLogin(String login) {
        if (login.contains("@")) {
            return accountRepository.findByEmail(login)
                    .orElseThrow(() -> new UsernameNotFoundException("Account not found."));
        }

        return accountRepository.findByUsername(login)
                .orElseThrow(() -> new UsernameNotFoundException("Account not found."));
    }
}
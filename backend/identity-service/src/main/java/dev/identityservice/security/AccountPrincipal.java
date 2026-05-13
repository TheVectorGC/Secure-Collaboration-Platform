package dev.identityservice.security;

import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.model.enumeration.AccountStatus;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public class AccountPrincipal implements UserDetails {
    private final AccountEntity accountEntity;

    public AccountPrincipal(AccountEntity accountEntity) {
        this.accountEntity = accountEntity;
    }

    public UUID getAccountId() {
        return accountEntity.getId();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + accountEntity.getRole().name()));
    }

    @Override
    public String getPassword() {
        return accountEntity.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return accountEntity.getUsername();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return accountEntity.getStatus() == AccountStatus.ACTIVE;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return accountEntity.getStatus() == AccountStatus.ACTIVE;
    }
}

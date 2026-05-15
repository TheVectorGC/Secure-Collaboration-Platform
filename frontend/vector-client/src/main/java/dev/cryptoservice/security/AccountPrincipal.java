package dev.cryptoservice.security;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public class AccountPrincipal implements UserDetails {
    private final UUID accountId;
    private final String username;
    private final List<String> roles;

    public AccountPrincipal(UUID accountId, String username, List<String> roles) {
        this.accountId = accountId;
        this.username = username;
        this.roles = roles;
    }

    public UUID getAccountId() {
        return accountId;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return roles.stream()
            .map(SimpleGrantedAuthority::new)
            .toList();
    }

    @Override
    public String getPassword() {
        return null;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}

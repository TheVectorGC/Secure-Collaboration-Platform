package dev.mediaservice.security;

import dev.mediaservice.service.JwtTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenService jwtTokenService;
    private final AuthenticationErrorResponseWriter authenticationErrorResponseWriter;

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        @NonNull HttpServletResponse response,
        @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String authorizationHeader = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (authorizationHeader == null || !authorizationHeader.startsWith(BEARER_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authorizationHeader.substring(BEARER_PREFIX.length());

        try {
            authenticateRequestIfRequired(request, token);
        }
        catch (RuntimeException exception) {
            log.warn("JWT authentication failed. path={}, reason={}", request.getRequestURI(), exception.getMessage());
            SecurityContextHolder.clearContext();
            authenticationErrorResponseWriter.writeUnauthorized(request, response, "Access token is invalid or expired.");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void authenticateRequestIfRequired(HttpServletRequest request, String token) {
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            return;
        }

        if (!jwtTokenService.validateToken(token)) {
            throw new IllegalArgumentException("Access token failed validation.");
        }

        Map<String, Object> claims = jwtTokenService.extractClaims(token);
        AccountPrincipal accountPrincipal = buildAccountPrincipal(claims);
        UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
            accountPrincipal,
            null,
            accountPrincipal.getAuthorities()
        );
        authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authenticationToken);
    }

    private AccountPrincipal buildAccountPrincipal(Map<String, Object> claims) {
        UUID accountId = UUID.fromString(String.valueOf(claims.get("accountId")));
        String username = String.valueOf(claims.get("sub"));
        Object rolesClaim = claims.get("roles");
        List<String> roles = rolesClaim instanceof List<?> roleList
            ? roleList.stream().map(String::valueOf).toList()
            : List.of();

        return new AccountPrincipal(accountId, username, roles);
    }
}

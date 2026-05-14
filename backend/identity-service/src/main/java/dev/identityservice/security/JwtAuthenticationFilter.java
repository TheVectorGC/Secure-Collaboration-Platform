package dev.identityservice.security;

import dev.identityservice.service.JwtTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtTokenService jwtTokenService;
    private final AuthenticationErrorResponseWriter authenticationErrorResponseWriter;

    @Lazy
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String requestTokenHeader = request.getHeader("Authorization");

        if (requestTokenHeader == null || !requestTokenHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String jwtToken = requestTokenHeader.substring(7);

        try {
            String username = jwtTokenService.extractUsername(jwtToken);

            if (username == null || username.isBlank()) {
                SecurityContextHolder.clearContext();
                authenticationErrorResponseWriter.writeUnauthorized(
                        request,
                        response,
                        "Access token is invalid or expired."
                );
                return;
            }

            if (SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                if (!jwtTokenService.validateToken(jwtToken, userDetails)) {
                    SecurityContextHolder.clearContext();
                    authenticationErrorResponseWriter.writeUnauthorized(
                            request,
                            response,
                            "Access token is invalid or expired."
                    );
                    return;
                }

                UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );
                authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authenticationToken);
            }
        }
        catch (RuntimeException exception) {
            log.warn("JWT token is invalid: {}.", exception.getMessage());
            SecurityContextHolder.clearContext();
            authenticationErrorResponseWriter.writeUnauthorized(
                    request,
                    response,
                    "Access token is invalid or expired."
            );
            return;
        }

        filterChain.doFilter(request, response);
    }
}

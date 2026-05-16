package dev.documentservice.security;

import dev.documentservice.exception.DocumentAccessDeniedException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@RequiredArgsConstructor
public class AuthorizationHeaderProvider {
    private final HttpServletRequest httpServletRequest;

    public String getAuthorizationHeader() {
        String authorizationHeader = httpServletRequest.getHeader(HttpHeaders.AUTHORIZATION);

        if (!StringUtils.hasText(authorizationHeader)) {
            throw new DocumentAccessDeniedException("Authorization header is required for document access validation.");
        }

        return authorizationHeader;
    }
}

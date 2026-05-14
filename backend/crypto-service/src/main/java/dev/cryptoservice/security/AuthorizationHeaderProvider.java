package dev.cryptoservice.security;

import dev.cryptoservice.exception.DeviceAccessDeniedException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
public class AuthorizationHeaderProvider {

    public String getAuthorizationHeader() {
        ServletRequestAttributes servletRequestAttributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();

        if (servletRequestAttributes == null) {
            throw new DeviceAccessDeniedException("Current request context is not available.");
        }

        HttpServletRequest httpServletRequest = servletRequestAttributes.getRequest();
        String authorizationHeader = httpServletRequest.getHeader(HttpHeaders.AUTHORIZATION);

        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new DeviceAccessDeniedException("Authorization header is missing.");
        }

        return authorizationHeader;
    }
}
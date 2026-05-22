package dev.messagingservice.service.impl;

import dev.messagingservice.exception.ChatAccessDeniedException;
import dev.messagingservice.service.CurrentAuthorizationHeaderService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
public class CurrentAuthorizationHeaderServiceImpl implements CurrentAuthorizationHeaderService {

    @Override
    public String getCurrentAuthorizationHeader() {
        RequestAttributes requestAttributes = RequestContextHolder.getRequestAttributes();

        if (!(requestAttributes instanceof ServletRequestAttributes servletRequestAttributes)) {
            throw new ChatAccessDeniedException("Current request is not available.");
        }

        HttpServletRequest request = servletRequestAttributes.getRequest();
        String authorizationHeader = request.getHeader("Authorization");

        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new ChatAccessDeniedException("Current authorization header is not available.");
        }

        return authorizationHeader;
    }
}

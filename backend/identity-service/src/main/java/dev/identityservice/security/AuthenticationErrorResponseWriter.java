package dev.identityservice.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.identityservice.common.error.ApiErrorResponse;
import dev.identityservice.common.error.ErrorCode;
import dev.identityservice.common.request.RequestIdProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.OffsetDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AuthenticationErrorResponseWriter {
    private final ObjectMapper objectMapper;
    private final RequestIdProvider requestIdProvider;

    public void writeUnauthorized(
            HttpServletRequest request,
            HttpServletResponse response,
            String message
    ) throws IOException {
        writeErrorResponse(request, response, HttpStatus.UNAUTHORIZED, ErrorCode.AUTHENTICATION_FAILED, message);
    }

    public void writeForbidden(
            HttpServletRequest request,
            HttpServletResponse response,
            String message
    ) throws IOException {
        writeErrorResponse(request, response, HttpStatus.FORBIDDEN, ErrorCode.ACCESS_DENIED, message);
    }

    private void writeErrorResponse(
            HttpServletRequest request,
            HttpServletResponse response,
            HttpStatus httpStatus,
            ErrorCode errorCode,
            String message
    ) throws IOException {
        if (response.isCommitted()) {
            return;
        }

        ApiErrorResponse apiErrorResponse = new ApiErrorResponse(
                OffsetDateTime.now(),
                requestIdProvider.currentRequestId(),
                httpStatus.value(),
                errorCode.name(),
                message,
                request.getRequestURI(),
                null
        );

        response.setStatus(httpStatus.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), apiErrorResponse);
    }
}

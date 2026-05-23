package dev.documentservice.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.documentservice.model.dto.error.ApiErrorResponseDto;
import dev.documentservice.provider.RequestIdProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AuthenticationErrorResponseWriter {
    private final ObjectMapper objectMapper;
    private final RequestIdProvider requestIdProvider;
    private final HttpServletRequest httpServletRequest;

    public void writeUnauthorized(HttpServletResponse response, String message) throws IOException {
        writeErrorResponse(response, HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED", message);
    }

    public void writeForbidden(HttpServletResponse response, String message) throws IOException {
        writeErrorResponse(response, HttpStatus.FORBIDDEN, "ACCESS_DENIED", message);
    }

    private void writeErrorResponse(HttpServletResponse response, HttpStatus httpStatus, String code, String message) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        ApiErrorResponseDto errorResponseDto = new ApiErrorResponseDto(
            OffsetDateTime.now(),
            requestIdProvider.getCurrentRequestId(),
            httpStatus.value(),
            code,
            message,
            httpServletRequest.getRequestURI(),
            List.of()
        );
        response.setStatus(httpStatus.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), errorResponseDto);
    }
}

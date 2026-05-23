package dev.identityservice.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.identityservice.model.dto.error.ApiErrorResponseDto;
import dev.identityservice.model.dto.error.ErrorCode;
import dev.identityservice.observability.RequestIdProvider;
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

        ApiErrorResponseDto apiErrorResponse = new ApiErrorResponseDto(
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

package dev.messagingservice.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.messagingservice.model.dto.error.ApiErrorResponseDto;
import dev.messagingservice.web.RequestIdProvider;
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

    public void writeUnauthorized(
            HttpServletRequest request,
            HttpServletResponse response,
            String message
    ) throws IOException {
        writeErrorResponse(request, response, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", message);
    }

    public void writeForbidden(
            HttpServletRequest request,
            HttpServletResponse response,
            String message
    ) throws IOException {
        writeErrorResponse(request, response, HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }

    private void writeErrorResponse(
            HttpServletRequest request,
            HttpServletResponse response,
            HttpStatus status,
            String code,
            String message
    ) throws IOException {
        ApiErrorResponseDto errorResponse = new ApiErrorResponseDto(
                OffsetDateTime.now(),
                requestIdProvider.getCurrentRequestId(),
                status.value(),
                code,
                message,
                request.getRequestURI(),
                List.of()
        );

        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(objectMapper.writeValueAsString(errorResponse));
    }
}

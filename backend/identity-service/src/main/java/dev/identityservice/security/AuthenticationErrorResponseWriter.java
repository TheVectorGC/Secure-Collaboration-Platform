package dev.identityservice.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.identityservice.controller.exceptionHandler.StandardErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AuthenticationErrorResponseWriter {
    private final ObjectMapper objectMapper;

    public void writeUnauthorized(
            HttpServletRequest request,
            HttpServletResponse response,
            String message
    ) throws IOException {
        writeErrorResponse(response, HttpStatus.UNAUTHORIZED, "Unauthorized", message);
    }

    public void writeForbidden(
            HttpServletResponse response,
            String message
    ) throws IOException {
        writeErrorResponse(response, HttpStatus.FORBIDDEN, "Forbidden", message);
    }

    private void writeErrorResponse(
            HttpServletResponse response,
            HttpStatus httpStatus,
            String error,
            String message
    ) throws IOException {
        if (response.isCommitted()) {
            return;
        }

        StandardErrorResponse standardErrorResponse = new StandardErrorResponse(
                error,
                message,
                LocalDateTime.now(),
                httpStatus.value()
        );

        response.setStatus(httpStatus.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), standardErrorResponse);
    }
}

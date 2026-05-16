package dev.documentservice.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.documentservice.controller.exceptionhandler.StandardErrorResponse;
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

    public void writeUnauthorized(HttpServletResponse response, String message) throws IOException {
        writeErrorResponse(response, HttpStatus.UNAUTHORIZED, "Unauthorized", message);
    }

    public void writeForbidden(HttpServletResponse response, String message) throws IOException {
        writeErrorResponse(response, HttpStatus.FORBIDDEN, "Forbidden", message);
    }

    private void writeErrorResponse(HttpServletResponse response, HttpStatus httpStatus, String error, String message) throws IOException {
        if (response.isCommitted()) {
            return;
        }

        StandardErrorResponse standardErrorResponse = new StandardErrorResponse(
                OffsetDateTime.now(),
                httpStatus.value(),
                error,
                message
        );

        response.setStatus(httpStatus.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), standardErrorResponse);
    }
}

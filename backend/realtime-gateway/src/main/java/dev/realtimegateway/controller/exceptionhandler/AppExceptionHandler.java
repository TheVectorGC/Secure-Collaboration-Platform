package dev.realtimegateway.controller.exceptionhandler;

import dev.realtimegateway.exception.TokenValidationException;
import dev.realtimegateway.exception.WebSocketAuthenticationException;
import dev.realtimegateway.filter.RequestIdFilter;
import dev.realtimegateway.model.dto.error.ApiErrorResponseDto;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class AppExceptionHandler {
    private static final String REQUEST_ID_MDC_KEY = "requestId";

    @ExceptionHandler({TokenValidationException.class, WebSocketAuthenticationException.class})
    public ResponseEntity<ApiErrorResponseDto> handleAuthenticationException(
            RuntimeException exception,
            HttpServletRequest httpServletRequest
    ) {
        log.warn("Realtime authentication failed. Path: {}.", httpServletRequest.getRequestURI());
        return buildResponse(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_FAILED", exception.getMessage(), httpServletRequest);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponseDto> handleException(
            Exception exception,
            HttpServletRequest httpServletRequest
    ) {
        log.error("Unexpected realtime gateway error. Path: {}.", httpServletRequest.getRequestURI(), exception);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Unexpected server error.", httpServletRequest);
    }

    private ResponseEntity<ApiErrorResponseDto> buildResponse(
            HttpStatus httpStatus,
            String code,
            String message,
            HttpServletRequest httpServletRequest
    ) {
        ApiErrorResponseDto apiErrorResponseDto = new ApiErrorResponseDto(
                OffsetDateTime.now(),
                resolveRequestId(),
                httpStatus.value(),
                code,
                message,
                httpServletRequest.getRequestURI(),
                List.of()
        );
        return ResponseEntity.status(httpStatus)
                .header(RequestIdFilter.REQUEST_ID_HEADER, apiErrorResponseDto.requestId())
                .body(apiErrorResponseDto);
    }

    private String resolveRequestId() {
        String requestId = MDC.get(REQUEST_ID_MDC_KEY);
        return requestId == null || requestId.isBlank() ? "none" : requestId;
    }
}

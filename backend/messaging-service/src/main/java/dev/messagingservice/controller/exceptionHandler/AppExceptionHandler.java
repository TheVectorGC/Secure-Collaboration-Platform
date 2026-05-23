package dev.messagingservice.controller.exceptionHandler;

import dev.messagingservice.exception.AccountBlockedException;
import dev.messagingservice.exception.ChatAccessDeniedException;
import dev.messagingservice.exception.ChatNotFoundException;
import dev.messagingservice.exception.DeviceDirectoryUnavailableException;
import dev.messagingservice.exception.MessageNotFoundException;
import dev.messagingservice.exception.MessagePayloadValidationException;
import dev.messagingservice.exception.TokenValidationException;
import dev.messagingservice.model.dto.error.ApiErrorResponseDto;
import dev.messagingservice.model.dto.error.FieldErrorResponseDto;
import dev.messagingservice.web.RequestIdProvider;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class AppExceptionHandler {
    private final RequestIdProvider requestIdProvider;

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponseDto> handleMethodArgumentNotValidException(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        List<FieldErrorResponseDto> fieldErrors = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .sorted(Comparator.comparing(FieldError::getField))
                .map(fieldError -> new FieldErrorResponseDto(
                        fieldError.getField(),
                        fieldError.getCode() == null ? "VALIDATION_ERROR" : fieldError.getCode(),
                        fieldError.getDefaultMessage() == null ? "Validation failed." : fieldError.getDefaultMessage()
                ))
                .toList();
        log.warn("Request validation failed. Field errors: {}.", fieldErrors.size());
        return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_FAILED",
                "Request validation failed.",
                request.getRequestURI(),
                fieldErrors
        );
    }

    @ExceptionHandler(ChatAccessDeniedException.class)
    public ResponseEntity<ApiErrorResponseDto> handleChatAccessDeniedException(ChatAccessDeniedException exception, HttpServletRequest request) {
        log.warn("Chat access denied. Reason: {}.", exception.getMessage());
        return buildErrorResponse(HttpStatus.FORBIDDEN, "CHAT_ACCESS_DENIED", exception.getMessage(), request.getRequestURI(), List.of());
    }

    @ExceptionHandler(AccountBlockedException.class)
    public ResponseEntity<ApiErrorResponseDto> handleAccountBlockedException(AccountBlockedException exception, HttpServletRequest request) {
        log.warn("Blocked account operation rejected. Reason: {}.", exception.getMessage());
        return buildErrorResponse(HttpStatus.FORBIDDEN, "ACCOUNT_BLOCKED", exception.getMessage(), request.getRequestURI(), List.of());
    }

    @ExceptionHandler(ChatNotFoundException.class)
    public ResponseEntity<ApiErrorResponseDto> handleChatNotFoundException(ChatNotFoundException exception, HttpServletRequest request) {
        log.warn("Chat was not found. Reason: {}.", exception.getMessage());
        return buildErrorResponse(HttpStatus.NOT_FOUND, "CHAT_NOT_FOUND", exception.getMessage(), request.getRequestURI(), List.of());
    }

    @ExceptionHandler(MessageNotFoundException.class)
    public ResponseEntity<ApiErrorResponseDto> handleMessageNotFoundException(MessageNotFoundException exception, HttpServletRequest request) {
        log.warn("Message was not found. Reason: {}.", exception.getMessage());
        return buildErrorResponse(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND", exception.getMessage(), request.getRequestURI(), List.of());
    }

    @ExceptionHandler(MessagePayloadValidationException.class)
    public ResponseEntity<ApiErrorResponseDto> handleMessagePayloadValidationException(MessagePayloadValidationException exception, HttpServletRequest request) {
        log.warn("Message payload validation failed. Reason: {}.", exception.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "MESSAGE_PAYLOAD_INVALID", exception.getMessage(), request.getRequestURI(), List.of());
    }

    @ExceptionHandler(TokenValidationException.class)
    public ResponseEntity<ApiErrorResponseDto> handleTokenValidationException(TokenValidationException exception, HttpServletRequest request) {
        log.warn("Token validation failed. Reason: {}.", exception.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "TOKEN_INVALID", exception.getMessage(), request.getRequestURI(), List.of());
    }

    @ExceptionHandler(DeviceDirectoryUnavailableException.class)
    public ResponseEntity<ApiErrorResponseDto> handleDeviceDirectoryUnavailableException(DeviceDirectoryUnavailableException exception, HttpServletRequest request) {
        log.warn("Identity device directory is unavailable. Reason: {}.", exception.getMessage());
        return buildErrorResponse(HttpStatus.BAD_GATEWAY, "DEVICE_DIRECTORY_UNAVAILABLE", exception.getMessage(), request.getRequestURI(), List.of());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponseDto> handleIllegalArgumentException(IllegalArgumentException exception, HttpServletRequest request) {
        log.warn("Invalid request argument. Reason: {}.", exception.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "INVALID_ARGUMENT", exception.getMessage(), request.getRequestURI(), List.of());
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiErrorResponseDto> handleRuntimeException(RuntimeException exception, HttpServletRequest request) {
        log.error("Unexpected error occurred.", exception);
        return buildErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "An unexpected error occurred. Please try again later.",
                request.getRequestURI(),
                List.of()
        );
    }

    private ResponseEntity<ApiErrorResponseDto> buildErrorResponse(
            HttpStatus status,
            String code,
            String message,
            String path,
            List<FieldErrorResponseDto> fieldErrors
    ) {
        ApiErrorResponseDto response = new ApiErrorResponseDto(
                OffsetDateTime.now(),
                requestIdProvider.getCurrentRequestId(),
                status.value(),
                code,
                message,
                path,
                fieldErrors
        );
        return ResponseEntity.status(status).body(response);
    }
}

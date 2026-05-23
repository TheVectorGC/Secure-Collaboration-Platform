package dev.cryptoservice.controller.exceptionhandler;

import dev.cryptoservice.exception.AccountBackupProfileConflictException;
import dev.cryptoservice.exception.AccountBackupProfileNotFoundException;
import dev.cryptoservice.exception.CryptoKeyValidationException;
import dev.cryptoservice.exception.DeviceAccessDeniedException;
import dev.cryptoservice.exception.DeviceIdentityKeyAlreadyExistsException;
import dev.cryptoservice.exception.DeviceIdentityKeyNotFoundException;
import dev.cryptoservice.exception.DeviceNotActiveException;
import dev.cryptoservice.exception.DeviceNotFoundException;
import dev.cryptoservice.exception.ExternalServiceException;
import dev.cryptoservice.exception.KyberPreKeyAlreadyExistsException;
import dev.cryptoservice.exception.KyberPreKeyNotFoundException;
import dev.cryptoservice.exception.KyberPreKeySignatureInvalidException;
import dev.cryptoservice.exception.OneTimePreKeyAlreadyExistsException;
import dev.cryptoservice.exception.PreKeyBundleNotAvailableException;
import dev.cryptoservice.exception.SignedPreKeyAlreadyExistsException;
import dev.cryptoservice.exception.SignedPreKeyNotFoundException;
import dev.cryptoservice.exception.SignedPreKeySignatureInvalidException;
import dev.cryptoservice.exception.TokenValidationException;
import dev.cryptoservice.model.dto.error.ApiErrorResponseDto;
import dev.cryptoservice.model.dto.error.FieldErrorResponseDto;
import dev.cryptoservice.observability.RequestIdProvider;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
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
        List<FieldErrorResponseDto> fieldErrors = exception.getBindingResult().getFieldErrors().stream()
            .map(fieldError -> new FieldErrorResponseDto(
                fieldError.getField(),
                fieldError.getCode(),
                fieldError.getDefaultMessage()
            ))
            .toList();

        log.warn("Request validation failed. path={}, fieldErrorCount={}", request.getRequestURI(), fieldErrors.size());

        return buildErrorResponse(
            HttpStatus.BAD_REQUEST,
            "VALIDATION_FAILED",
            "Request validation failed.",
            request.getRequestURI(),
            fieldErrors
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponseDto> handleAccessDeniedException(HttpServletRequest request) {
        log.warn("Access denied. path={}", request.getRequestURI());
        return buildErrorResponse(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "You do not have permission to access this resource.", request.getRequestURI());
    }

    @ExceptionHandler({DeviceAccessDeniedException.class, DeviceNotActiveException.class})
    public ResponseEntity<ApiErrorResponseDto> handleForbiddenException(RuntimeException exception, HttpServletRequest request) {
        log.warn("Forbidden crypto request. code={}, path={}, message={}", exception.getClass().getSimpleName(), request.getRequestURI(), exception.getMessage());
        return buildErrorResponse(HttpStatus.FORBIDDEN, toErrorCode(exception), exception.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler({DeviceNotFoundException.class, DeviceIdentityKeyNotFoundException.class, SignedPreKeyNotFoundException.class, KyberPreKeyNotFoundException.class, PreKeyBundleNotAvailableException.class, AccountBackupProfileNotFoundException.class})
    public ResponseEntity<ApiErrorResponseDto> handleNotFoundException(RuntimeException exception, HttpServletRequest request) {
        log.warn("Crypto resource was not found. code={}, path={}, message={}", exception.getClass().getSimpleName(), request.getRequestURI(), exception.getMessage());
        return buildErrorResponse(HttpStatus.NOT_FOUND, toErrorCode(exception), exception.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler({DeviceIdentityKeyAlreadyExistsException.class, SignedPreKeyAlreadyExistsException.class, KyberPreKeyAlreadyExistsException.class, OneTimePreKeyAlreadyExistsException.class, AccountBackupProfileConflictException.class})
    public ResponseEntity<ApiErrorResponseDto> handleConflictException(RuntimeException exception, HttpServletRequest request) {
        log.warn("Crypto resource conflict. code={}, path={}, message={}", exception.getClass().getSimpleName(), request.getRequestURI(), exception.getMessage());
        return buildErrorResponse(HttpStatus.CONFLICT, toErrorCode(exception), exception.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler({CryptoKeyValidationException.class, SignedPreKeySignatureInvalidException.class, KyberPreKeySignatureInvalidException.class, TokenValidationException.class})
    public ResponseEntity<ApiErrorResponseDto> handleBadRequestException(RuntimeException exception, HttpServletRequest request) {
        log.warn("Invalid crypto request. code={}, path={}, message={}", exception.getClass().getSimpleName(), request.getRequestURI(), exception.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, toErrorCode(exception), exception.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(ExternalServiceException.class)
    public ResponseEntity<ApiErrorResponseDto> handleExternalServiceException(ExternalServiceException exception, HttpServletRequest request) {
        log.warn("External service request failed. path={}, message={}", request.getRequestURI(), exception.getMessage());
        return buildErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, "EXTERNAL_SERVICE_UNAVAILABLE", exception.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiErrorResponseDto> handleRuntimeException(RuntimeException exception, HttpServletRequest request) {
        log.error("Unexpected crypto-service error. path={}, message={}", request.getRequestURI(), exception.getMessage(), exception);
        return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR", "An unexpected error occurred. Please try again later.", request.getRequestURI());
    }

    private ResponseEntity<ApiErrorResponseDto> buildErrorResponse(HttpStatus httpStatus, String code, String message, String path) {
        return buildErrorResponse(httpStatus, code, message, path, List.of());
    }

    private ResponseEntity<ApiErrorResponseDto> buildErrorResponse(
        HttpStatus httpStatus,
        String code,
        String message,
        String path,
        List<FieldErrorResponseDto> fieldErrors
    ) {
        ApiErrorResponseDto errorResponse = new ApiErrorResponseDto(
            OffsetDateTime.now(),
            requestIdProvider.getCurrentRequestId(),
            httpStatus.value(),
            code,
            message,
            path,
            fieldErrors
        );

        return new ResponseEntity<>(errorResponse, httpStatus);
    }

    private String toErrorCode(RuntimeException exception) {
        String simpleName = exception.getClass().getSimpleName();
        String withoutExceptionSuffix = simpleName.endsWith("Exception") ? simpleName.substring(0, simpleName.length() - 9) : simpleName;
        return withoutExceptionSuffix.replaceAll("([a-z])([A-Z])", "$1_$2").toUpperCase();
    }
}

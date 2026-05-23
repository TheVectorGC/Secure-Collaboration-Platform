package dev.identityservice.controller.exceptionHandler;

import dev.identityservice.common.error.ApiErrorResponse;
import dev.identityservice.common.error.ErrorCode;
import dev.identityservice.common.error.FieldErrorResponse;
import dev.identityservice.common.request.RequestIdProvider;
import dev.identityservice.exception.AccountAlreadyExistsException;
import dev.identityservice.exception.AccountBlockedException;
import dev.identityservice.exception.AccountNotFoundException;
import dev.identityservice.exception.DeviceNotFoundException;
import dev.identityservice.exception.DeviceRegistrationException;
import dev.identityservice.exception.DeviceRevokedException;
import dev.identityservice.exception.InvalidRefreshTokenException;
import dev.identityservice.exception.InvalidRegistrationTokenException;
import dev.identityservice.exception.PasswordConfirmationMismatchException;
import dev.identityservice.exception.RegistrationAlreadyCompletedException;
import dev.identityservice.exception.RegistrationExpiredException;
import dev.identityservice.exception.RegistrationNotFoundException;
import dev.identityservice.exception.TokenSigningException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class AppExceptionHandler {
    private final RequestIdProvider requestIdProvider;

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleMethodArgumentNotValidException(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        List<FieldErrorResponse> fieldErrors = exception.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> new FieldErrorResponse(
                        fieldError.getField(),
                        resolveValidationCode(fieldError.getCode()),
                        fieldError.getDefaultMessage()
                ))
                .sorted(Comparator.comparing(FieldErrorResponse::field).thenComparing(FieldErrorResponse::code))
                .toList();

        log.warn("Request validation failed. Field error count: {}.", fieldErrors.size());
        return buildErrorResponse(
                ErrorCode.VALIDATION_FAILED,
                "Request validation failed.",
                HttpStatus.BAD_REQUEST,
                request,
                fieldErrors
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDeniedException(AccessDeniedException exception, HttpServletRequest request) {
        log.warn("Access denied: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.ACCESS_DENIED, "Access denied.", HttpStatus.FORBIDDEN, request, List.of());
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiErrorResponse> handleBadCredentialsException(BadCredentialsException exception, HttpServletRequest request) {
        log.warn("Authentication failed: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.AUTHENTICATION_FAILED, "Invalid login or password.", HttpStatus.UNAUTHORIZED, request, List.of());
    }

    @ExceptionHandler(AccountAlreadyExistsException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountAlreadyExistsException(AccountAlreadyExistsException exception, HttpServletRequest request) {
        log.warn("Account already exists: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.ACCOUNT_ALREADY_EXISTS, exception.getMessage(), HttpStatus.CONFLICT, request, List.of());
    }

    @ExceptionHandler(AccountBlockedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountBlockedException(AccountBlockedException exception, HttpServletRequest request) {
        log.warn("Blocked account request: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.ACCOUNT_BLOCKED, exception.getMessage(), HttpStatus.FORBIDDEN, request, List.of());
    }

    @ExceptionHandler(AccountNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountNotFoundException(AccountNotFoundException exception, HttpServletRequest request) {
        log.warn("Account not found: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.ACCOUNT_NOT_FOUND, exception.getMessage(), HttpStatus.NOT_FOUND, request, List.of());
    }

    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidRefreshTokenException(InvalidRefreshTokenException exception, HttpServletRequest request) {
        log.warn("Invalid refresh token: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.INVALID_REFRESH_TOKEN, exception.getMessage(), HttpStatus.UNAUTHORIZED, request, List.of());
    }

    @ExceptionHandler(InvalidRegistrationTokenException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidRegistrationTokenException(InvalidRegistrationTokenException exception, HttpServletRequest request) {
        log.warn("Invalid registration token: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.INVALID_REGISTRATION_TOKEN, exception.getMessage(), HttpStatus.BAD_REQUEST, request, List.of());
    }

    @ExceptionHandler(PasswordConfirmationMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handlePasswordConfirmationMismatchException(PasswordConfirmationMismatchException exception, HttpServletRequest request) {
        log.warn("Password confirmation mismatch: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.PASSWORD_CONFIRMATION_MISMATCH, exception.getMessage(), HttpStatus.BAD_REQUEST, request, List.of());
    }

    @ExceptionHandler(RegistrationAlreadyCompletedException.class)
    public ResponseEntity<ApiErrorResponse> handleRegistrationAlreadyCompletedException(RegistrationAlreadyCompletedException exception, HttpServletRequest request) {
        log.warn("Registration already completed: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.REGISTRATION_ALREADY_COMPLETED, exception.getMessage(), HttpStatus.CONFLICT, request, List.of());
    }

    @ExceptionHandler(RegistrationExpiredException.class)
    public ResponseEntity<ApiErrorResponse> handleRegistrationExpiredException(RegistrationExpiredException exception, HttpServletRequest request) {
        log.warn("Registration expired: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.REGISTRATION_EXPIRED, exception.getMessage(), HttpStatus.BAD_REQUEST, request, List.of());
    }

    @ExceptionHandler(RegistrationNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleRegistrationNotFoundException(RegistrationNotFoundException exception, HttpServletRequest request) {
        log.warn("Registration not found: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.REGISTRATION_NOT_FOUND, exception.getMessage(), HttpStatus.NOT_FOUND, request, List.of());
    }

    @ExceptionHandler(TokenSigningException.class)
    public ResponseEntity<ApiErrorResponse> handleTokenSigningException(TokenSigningException exception, HttpServletRequest request) {
        log.error("Token signing failed: {}.", exception.getMessage(), exception);
        return buildErrorResponse(ErrorCode.TOKEN_SIGNING_FAILED, "Unable to issue token.", HttpStatus.INTERNAL_SERVER_ERROR, request, List.of());
    }

    @ExceptionHandler(DeviceNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleDeviceNotFoundException(DeviceNotFoundException exception, HttpServletRequest request) {
        log.warn("Device not found: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.DEVICE_NOT_FOUND, exception.getMessage(), HttpStatus.NOT_FOUND, request, List.of());
    }

    @ExceptionHandler(DeviceRevokedException.class)
    public ResponseEntity<ApiErrorResponse> handleDeviceRevokedException(DeviceRevokedException exception, HttpServletRequest request) {
        log.warn("Revoked device request: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.DEVICE_REVOKED, exception.getMessage(), HttpStatus.FORBIDDEN, request, List.of());
    }

    @ExceptionHandler(DeviceRegistrationException.class)
    public ResponseEntity<ApiErrorResponse> handleDeviceRegistrationException(DeviceRegistrationException exception, HttpServletRequest request) {
        log.warn("Device registration failed: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.DEVICE_REGISTRATION_FAILED, exception.getMessage(), HttpStatus.BAD_REQUEST, request, List.of());
    }


    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgumentException(IllegalArgumentException exception, HttpServletRequest request) {
        log.warn("Invalid request argument: {}.", exception.getMessage());
        return buildErrorResponse(ErrorCode.VALIDATION_FAILED, exception.getMessage(), HttpStatus.BAD_REQUEST, request, List.of());
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiErrorResponse> handleRuntimeException(RuntimeException exception, HttpServletRequest request) {
        log.error("Unexpected identity-service error: {}.", exception.getMessage(), exception);
        return buildErrorResponse(ErrorCode.INTERNAL_SERVER_ERROR, "An unexpected error occurred.", HttpStatus.INTERNAL_SERVER_ERROR, request, List.of());
    }

    private ResponseEntity<ApiErrorResponse> buildErrorResponse(
            ErrorCode errorCode,
            String message,
            HttpStatus httpStatus,
            HttpServletRequest request,
            List<FieldErrorResponse> fieldErrors
    ) {
        ApiErrorResponse apiErrorResponse = new ApiErrorResponse(
                OffsetDateTime.now(),
                requestIdProvider.currentRequestId(),
                httpStatus.value(),
                errorCode.name(),
                message,
                request.getRequestURI(),
                fieldErrors.isEmpty() ? null : fieldErrors
        );

        return new ResponseEntity<>(apiErrorResponse, httpStatus);
    }

    private String resolveValidationCode(String code) {
        if (code == null || code.isBlank()) {
            return "VALIDATION_ERROR";
        }

        return code;
    }
}

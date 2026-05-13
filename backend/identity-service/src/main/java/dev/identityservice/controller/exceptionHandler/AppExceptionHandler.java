package dev.identityservice.controller.exceptionHandler;

import dev.identityservice.exception.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
public class AppExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ValidationErrorResponse> handleMethodArgumentNotValidException(MethodArgumentNotValidException exception) {
        Map<String, List<String>> validationErrors = new HashMap<>();

        exception.getBindingResult().getFieldErrors().forEach(error -> {
            String fieldName = error.getField();
            String errorMessage = error.getDefaultMessage();

            validationErrors.computeIfAbsent(fieldName, key -> new ArrayList<>()).add(errorMessage);
        });

        log.warn("MethodArgumentNotValidException: {}.", exception.getMessage());
        return buildValidationErrorResponse(validationErrors);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<StandardErrorResponse> handleAccessDeniedException(AccessDeniedException exception) {
        log.warn("AccessDeniedException: {}.", exception.getMessage());
        return buildStandardErrorResponse("Access Denied", "You don't have permission to access this resource", HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<StandardErrorResponse> handleBadCredentialsException(BadCredentialsException exception) {
        log.warn("BadCredentialsException: {}.", exception.getMessage());
        return buildStandardErrorResponse("Authentication Failed", "Invalid login or password", HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(AccountAlreadyExistsException.class)
    public ResponseEntity<StandardErrorResponse> handleAccountAlreadyExistsException(AccountAlreadyExistsException exception) {
        log.warn("AccountAlreadyExistsException: {}.", exception.getMessage());
        return buildStandardErrorResponse("AccountAlreadyExistsException", exception.getMessage(), HttpStatus.CONFLICT);
    }

    @ExceptionHandler(AccountBlockedException.class)
    public ResponseEntity<StandardErrorResponse> handleAccountBlockedException(AccountBlockedException exception) {
        log.warn("AccountBlockedException: {}.", exception.getMessage());
        return buildStandardErrorResponse("AccountBlockedException", exception.getMessage(), HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(AccountNotFoundException.class)
    public ResponseEntity<StandardErrorResponse> handleAccountNotFoundException(AccountNotFoundException exception) {
        log.warn("AccountNotFoundException: {}.", exception.getMessage());
        return buildStandardErrorResponse("AccountNotFoundException", exception.getMessage(), HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ResponseEntity<StandardErrorResponse> handleInvalidRefreshTokenException(InvalidRefreshTokenException exception) {
        log.warn("InvalidRefreshTokenException: {}.", exception.getMessage());
        return buildStandardErrorResponse("InvalidRefreshTokenException", exception.getMessage(), HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(InvalidRegistrationTokenException.class)
    public ResponseEntity<StandardErrorResponse> handleInvalidRegistrationTokenException(InvalidRegistrationTokenException exception) {
        log.warn("InvalidRegistrationTokenException: {}.", exception.getMessage());
        return buildStandardErrorResponse("InvalidRegistrationTokenException", exception.getMessage(), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(PasswordConfirmationMismatchException.class)
    public ResponseEntity<StandardErrorResponse> handlePasswordConfirmationMismatchException(PasswordConfirmationMismatchException exception) {
        log.warn("PasswordConfirmationMismatchException: {}.", exception.getMessage());
        return buildStandardErrorResponse("PasswordConfirmationMismatchException", exception.getMessage(), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(RegistrationAlreadyCompletedException.class)
    public ResponseEntity<StandardErrorResponse> handleRegistrationAlreadyCompletedException(RegistrationAlreadyCompletedException exception) {
        log.warn("RegistrationAlreadyCompletedException: {}.", exception.getMessage());
        return buildStandardErrorResponse("RegistrationAlreadyCompletedException", exception.getMessage(), HttpStatus.CONFLICT);
    }

    @ExceptionHandler(RegistrationExpiredException.class)
    public ResponseEntity<StandardErrorResponse> handleRegistrationExpiredException(RegistrationExpiredException exception) {
        log.warn("RegistrationExpiredException: {}.", exception.getMessage());
        return buildStandardErrorResponse("RegistrationExpiredException", exception.getMessage(), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(RegistrationNotFoundException.class)
    public ResponseEntity<StandardErrorResponse> handleRegistrationNotFoundException(RegistrationNotFoundException exception) {
        log.warn("RegistrationNotFoundException: {}.", exception.getMessage());
        return buildStandardErrorResponse("RegistrationNotFoundException", exception.getMessage(), HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(TokenSigningException.class)
    public ResponseEntity<StandardErrorResponse> handleTokenSigningException(TokenSigningException exception) {
        log.error("TokenSigningException: {}.", exception.getMessage(), exception);
        return buildStandardErrorResponse("TokenSigningException", "Unable to issue token", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(DeviceNotFoundException.class)
    public ResponseEntity<StandardErrorResponse> handleDeviceNotFoundException(DeviceNotFoundException exception) {
        log.warn("DeviceNotFoundException: {}", exception.getMessage());
        return buildStandardErrorResponse("DeviceNotFoundException", exception.getMessage(), HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(DeviceRevokedException.class)
    public ResponseEntity<StandardErrorResponse> handleDeviceRevokedException(DeviceRevokedException exception) {
        log.warn("DeviceRevokedException: {}", exception.getMessage());
        return buildStandardErrorResponse("DeviceRevokedException", exception.getMessage(), HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(DeviceRegistrationException.class)
    public ResponseEntity<StandardErrorResponse> handleDeviceRegistrationException(DeviceRegistrationException exception) {
        log.warn("DeviceRegistrationException: {}", exception.getMessage());
        return buildStandardErrorResponse("DeviceRegistrationException", exception.getMessage(), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<StandardErrorResponse> handleRuntimeException(RuntimeException exception) {
        log.error("Unexpected error occurred: {}.", exception.getMessage(), exception);
        return buildStandardErrorResponse("Internal Server Error", "An unexpected error occurred. Please try again later.", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private ResponseEntity<StandardErrorResponse> buildStandardErrorResponse(String error, String message, HttpStatus status) {
        StandardErrorResponse standardErrorResponse = new StandardErrorResponse(error, message, LocalDateTime.now(), status.value());
        return new ResponseEntity<>(standardErrorResponse, status);
    }

    private ResponseEntity<ValidationErrorResponse> buildValidationErrorResponse(Map<String, List<String>> validationErrors) {
        ValidationErrorResponse validationErrorResponse = new ValidationErrorResponse(
                "Validation Error",
                validationErrors,
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value()
        );
        return new ResponseEntity<>(validationErrorResponse, HttpStatus.BAD_REQUEST);
    }
}

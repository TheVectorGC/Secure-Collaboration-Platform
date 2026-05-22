package dev.cryptoservice.controller.exceptionHandler;

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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
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

        return buildStandardErrorResponse("AccessDeniedException", "You don't have permission to access this resource.", HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(DeviceAccessDeniedException.class)
    public ResponseEntity<StandardErrorResponse> handleDeviceAccessDeniedException(DeviceAccessDeniedException exception) {
        log.warn("DeviceAccessDeniedException: {}.", exception.getMessage());

        return buildStandardErrorResponse("DeviceAccessDeniedException", exception.getMessage(), HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(DeviceNotActiveException.class)
    public ResponseEntity<StandardErrorResponse> handleDeviceNotActiveException(DeviceNotActiveException exception) {
        log.warn("DeviceNotActiveException: {}.", exception.getMessage());

        return buildStandardErrorResponse("DeviceNotActiveException", exception.getMessage(), HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(DeviceNotFoundException.class)
    public ResponseEntity<StandardErrorResponse> handleDeviceNotFoundException(DeviceNotFoundException exception) {
        log.warn("DeviceNotFoundException: {}.", exception.getMessage());

        return buildStandardErrorResponse("DeviceNotFoundException", exception.getMessage(), HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler({DeviceIdentityKeyNotFoundException.class, SignedPreKeyNotFoundException.class, KyberPreKeyNotFoundException.class, PreKeyBundleNotAvailableException.class, AccountBackupProfileNotFoundException.class})
    public ResponseEntity<StandardErrorResponse> handleNotFoundException(RuntimeException exception) {
        log.warn("{}: {}.", exception.getClass().getSimpleName(), exception.getMessage());

        return buildStandardErrorResponse(exception.getClass().getSimpleName(), exception.getMessage(), HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler({DeviceIdentityKeyAlreadyExistsException.class, SignedPreKeyAlreadyExistsException.class, KyberPreKeyAlreadyExistsException.class, OneTimePreKeyAlreadyExistsException.class})
    public ResponseEntity<StandardErrorResponse> handleConflictException(RuntimeException exception) {
        log.warn("{}: {}.", exception.getClass().getSimpleName(), exception.getMessage());

        return buildStandardErrorResponse(exception.getClass().getSimpleName(), exception.getMessage(), HttpStatus.CONFLICT);
    }

    @ExceptionHandler({CryptoKeyValidationException.class, SignedPreKeySignatureInvalidException.class, KyberPreKeySignatureInvalidException.class, TokenValidationException.class})
    public ResponseEntity<StandardErrorResponse> handleBadRequestException(RuntimeException exception) {
        log.warn("{}: {}.", exception.getClass().getSimpleName(), exception.getMessage());

        return buildStandardErrorResponse(exception.getClass().getSimpleName(), exception.getMessage(), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(ExternalServiceException.class)
    public ResponseEntity<StandardErrorResponse> handleExternalServiceException(ExternalServiceException exception) {
        log.warn("ExternalServiceException: {}.", exception.getMessage());

        return buildStandardErrorResponse("ExternalServiceException", exception.getMessage(), HttpStatus.SERVICE_UNAVAILABLE);
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

package dev.documentservice.controller.exceptionhandler;

import dev.documentservice.exception.DocumentAccessDeniedException;
import dev.documentservice.exception.DocumentAlreadySignedException;
import dev.documentservice.exception.DocumentNotFoundException;
import dev.documentservice.exception.DocumentRejectedException;
import dev.documentservice.exception.DocumentValidationException;
import dev.documentservice.exception.ExternalServiceException;
import dev.documentservice.exception.SigningKeyNotFoundException;
import dev.documentservice.exception.TokenValidationException;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class AppExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ValidationErrorResponse> handleMethodArgumentNotValidException(MethodArgumentNotValidException exception) {
        List<String> validationErrors = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::formatFieldError)
                .toList();

        ValidationErrorResponse response = new ValidationErrorResponse(
                OffsetDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                "Validation Error",
                "Validation failed.",
                validationErrors
        );

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler({AccessDeniedException.class, DocumentAccessDeniedException.class})
    public ResponseEntity<StandardErrorResponse> handleAccessDeniedException(RuntimeException exception) {
        log.warn("{}: {}.", exception.getClass().getSimpleName(), exception.getMessage());
        return buildStandardErrorResponse(HttpStatus.FORBIDDEN, exception.getClass().getSimpleName(), exception.getMessage());
    }

    @ExceptionHandler({DocumentNotFoundException.class, SigningKeyNotFoundException.class})
    public ResponseEntity<StandardErrorResponse> handleNotFoundException(RuntimeException exception) {
        log.warn("{}: {}.", exception.getClass().getSimpleName(), exception.getMessage());
        return buildStandardErrorResponse(HttpStatus.NOT_FOUND, exception.getClass().getSimpleName(), exception.getMessage());
    }

    @ExceptionHandler({DocumentValidationException.class, DocumentRejectedException.class, TokenValidationException.class})
    public ResponseEntity<StandardErrorResponse> handleBadRequestException(RuntimeException exception) {
        log.warn("{}: {}.", exception.getClass().getSimpleName(), exception.getMessage());
        return buildStandardErrorResponse(HttpStatus.BAD_REQUEST, exception.getClass().getSimpleName(), exception.getMessage());
    }

    @ExceptionHandler(DocumentAlreadySignedException.class)
    public ResponseEntity<StandardErrorResponse> handleConflictException(DocumentAlreadySignedException exception) {
        log.warn("DocumentAlreadySignedException: {}.", exception.getMessage());
        return buildStandardErrorResponse(HttpStatus.CONFLICT, "DocumentAlreadySignedException", exception.getMessage());
    }

    @ExceptionHandler(ExternalServiceException.class)
    public ResponseEntity<StandardErrorResponse> handleExternalServiceException(ExternalServiceException exception) {
        log.warn("ExternalServiceException: {}.", exception.getMessage());
        return buildStandardErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, "ExternalServiceException", exception.getMessage());
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<StandardErrorResponse> handleRuntimeException(RuntimeException exception) {
        log.error("Unexpected error occurred: {}.", exception.getMessage(), exception);
        return buildStandardErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error", "Unexpected server error.");
    }

    private ResponseEntity<StandardErrorResponse> buildStandardErrorResponse(HttpStatus status, String error, String message) {
        StandardErrorResponse response = new StandardErrorResponse(
                OffsetDateTime.now(),
                status.value(),
                error,
                message
        );

        return ResponseEntity.status(status).body(response);
    }

    private String formatFieldError(FieldError fieldError) {
        return fieldError.getField() + ": " + fieldError.getDefaultMessage();
    }
}

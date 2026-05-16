package dev.mediaservice.controller.exceptionhandler;

import dev.mediaservice.exception.MediaAccessDeniedException;
import dev.mediaservice.exception.MediaFileNotFoundException;
import dev.mediaservice.exception.MediaStorageException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class AppExceptionHandler {
    @ExceptionHandler(MediaFileNotFoundException.class)
    public ResponseEntity<StandardErrorResponse> handleMediaFileNotFoundException(
        MediaFileNotFoundException exception,
        HttpServletRequest request
    ) {
        log.warn("MediaFileNotFoundException: {}.", exception.getMessage());
        return buildStandardErrorResponse(HttpStatus.NOT_FOUND, exception.getMessage(), request);
    }

    @ExceptionHandler(MediaAccessDeniedException.class)
    public ResponseEntity<StandardErrorResponse> handleMediaAccessDeniedException(
        MediaAccessDeniedException exception,
        HttpServletRequest request
    ) {
        log.warn("MediaAccessDeniedException: {}.", exception.getMessage());
        return buildStandardErrorResponse(HttpStatus.FORBIDDEN, exception.getMessage(), request);
    }

    @ExceptionHandler(MediaStorageException.class)
    public ResponseEntity<StandardErrorResponse> handleMediaStorageException(
        MediaStorageException exception,
        HttpServletRequest request
    ) {
        log.warn("MediaStorageException: {}.", exception.getMessage());
        return buildStandardErrorResponse(HttpStatus.BAD_REQUEST, exception.getMessage(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ValidationErrorResponse> handleMethodArgumentNotValidException(
        MethodArgumentNotValidException exception,
        HttpServletRequest request
    ) {
        List<String> validationErrors = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::formatFieldError)
                .toList();

        ValidationErrorResponse response = new ValidationErrorResponse(
                OffsetDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Validation failed.",
                request.getRequestURI(),
                validationErrors
        );

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<StandardErrorResponse> handleException(
        Exception exception,
        HttpServletRequest request
    ) {
        log.error("Unexpected error occurred: {}.", exception.getMessage(), exception);
        return buildStandardErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected server error.", request);
    }

    private ResponseEntity<StandardErrorResponse> buildStandardErrorResponse(
        HttpStatus status,
        String message,
        HttpServletRequest request
    ) {
        StandardErrorResponse response = new StandardErrorResponse(
                OffsetDateTime.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                request.getRequestURI()
        );

        return ResponseEntity.status(status).body(response);
    }

    private String formatFieldError(FieldError fieldError) {
        return fieldError.getField() + ": " + fieldError.getDefaultMessage();
    }
}

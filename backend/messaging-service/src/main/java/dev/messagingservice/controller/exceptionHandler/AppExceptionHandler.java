package dev.messagingservice.controller.exceptionHandler;

import dev.messagingservice.exception.ChatAccessDeniedException;
import dev.messagingservice.exception.ChatNotFoundException;
import dev.messagingservice.exception.DuplicateClientMessageException;
import dev.messagingservice.exception.MessageNotFoundException;
import dev.messagingservice.exception.MessagePayloadValidationException;
import dev.messagingservice.exception.TokenValidationException;
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

    @ExceptionHandler({AccessDeniedException.class, ChatAccessDeniedException.class})
    public ResponseEntity<StandardErrorResponse> handleAccessDeniedException(RuntimeException exception) {
        log.warn("{}: {}.", exception.getClass().getSimpleName(), exception.getMessage());
        return buildStandardErrorResponse(exception.getClass().getSimpleName(), exception.getMessage(), HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler({ChatNotFoundException.class, MessageNotFoundException.class})
    public ResponseEntity<StandardErrorResponse> handleNotFoundException(RuntimeException exception) {
        log.warn("{}: {}.", exception.getClass().getSimpleName(), exception.getMessage());
        return buildStandardErrorResponse(exception.getClass().getSimpleName(), exception.getMessage(), HttpStatus.NOT_FOUND);
    }


    @ExceptionHandler(MessagePayloadValidationException.class)
    public ResponseEntity<StandardErrorResponse> handleMessagePayloadValidationException(MessagePayloadValidationException exception) {
        log.warn("MessagePayloadValidationException: {}.", exception.getMessage());
        return buildStandardErrorResponse("MessagePayloadValidationException", exception.getMessage(), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(DuplicateClientMessageException.class)
    public ResponseEntity<StandardErrorResponse> handleDuplicateClientMessageException(DuplicateClientMessageException exception) {
        log.warn("DuplicateClientMessageException: {}.", exception.getMessage());
        return buildStandardErrorResponse("DuplicateClientMessageException", exception.getMessage(), HttpStatus.CONFLICT);
    }

    @ExceptionHandler(TokenValidationException.class)
    public ResponseEntity<StandardErrorResponse> handleTokenValidationException(TokenValidationException exception) {
        log.warn("TokenValidationException: {}.", exception.getMessage());
        return buildStandardErrorResponse("TokenValidationException", exception.getMessage(), HttpStatus.BAD_REQUEST);
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

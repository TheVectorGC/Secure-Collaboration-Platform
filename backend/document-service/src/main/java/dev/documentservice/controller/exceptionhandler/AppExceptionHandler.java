package dev.documentservice.controller.exceptionhandler;

import dev.documentservice.exception.DocumentAccessDeniedException;
import dev.documentservice.exception.DocumentAlreadySignedException;
import dev.documentservice.exception.DocumentNotFoundException;
import dev.documentservice.exception.DocumentRejectedException;
import dev.documentservice.exception.DocumentValidationException;
import dev.documentservice.exception.ExternalServiceException;
import dev.documentservice.exception.SigningKeyNotFoundException;
import dev.documentservice.exception.TokenValidationException;
import dev.documentservice.model.dto.error.ApiErrorResponseDto;
import dev.documentservice.model.dto.error.FieldErrorResponseDto;
import dev.documentservice.provider.RequestIdProvider;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
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
@RequiredArgsConstructor
public class AppExceptionHandler {
    private final RequestIdProvider requestIdProvider;

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponseDto> handleMethodArgumentNotValidException(MethodArgumentNotValidException exception, HttpServletRequest request) {
        List<FieldErrorResponseDto> fieldErrors = exception.getBindingResult().getFieldErrors().stream().map(this::toFieldErrorResponseDto).toList();
        log.warn("Request validation failed. path={} fieldErrorCount={}", request.getRequestURI(), fieldErrors.size());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request validation failed.", request, fieldErrors);
    }

    @ExceptionHandler({AccessDeniedException.class, DocumentAccessDeniedException.class})
    public ResponseEntity<ApiErrorResponseDto> handleAccessDeniedException(RuntimeException exception, HttpServletRequest request) {
        log.warn("Document request access denied. path={} reason={}", request.getRequestURI(), exception.getMessage());
        return buildErrorResponse(HttpStatus.FORBIDDEN, "DOCUMENT_ACCESS_DENIED", exception.getMessage(), request, List.of());
    }

    @ExceptionHandler({DocumentNotFoundException.class, SigningKeyNotFoundException.class})
    public ResponseEntity<ApiErrorResponseDto> handleNotFoundException(RuntimeException exception, HttpServletRequest request) {
        log.warn("Document resource was not found. path={} reason={}", request.getRequestURI(), exception.getMessage());
        return buildErrorResponse(HttpStatus.NOT_FOUND, "DOCUMENT_RESOURCE_NOT_FOUND", exception.getMessage(), request, List.of());
    }

    @ExceptionHandler({DocumentValidationException.class, DocumentRejectedException.class, TokenValidationException.class})
    public ResponseEntity<ApiErrorResponseDto> handleBadRequestException(RuntimeException exception, HttpServletRequest request) {
        log.warn("Document request rejected. path={} reason={}", request.getRequestURI(), exception.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "DOCUMENT_REQUEST_INVALID", exception.getMessage(), request, List.of());
    }

    @ExceptionHandler(DocumentAlreadySignedException.class)
    public ResponseEntity<ApiErrorResponseDto> handleConflictException(DocumentAlreadySignedException exception, HttpServletRequest request) {
        log.warn("Document request conflict. path={} reason={}", request.getRequestURI(), exception.getMessage());
        return buildErrorResponse(HttpStatus.CONFLICT, "DOCUMENT_CONFLICT", exception.getMessage(), request, List.of());
    }

    @ExceptionHandler(ExternalServiceException.class)
    public ResponseEntity<ApiErrorResponseDto> handleExternalServiceException(ExternalServiceException exception, HttpServletRequest request) {
        log.warn("Document dependency request failed. path={} reason={}", request.getRequestURI(), exception.getMessage());
        return buildErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, "DOCUMENT_DEPENDENCY_UNAVAILABLE", exception.getMessage(), request, List.of());
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiErrorResponseDto> handleRuntimeException(RuntimeException exception, HttpServletRequest request) {
        log.error("Unexpected document-service error. path={} reason={}", request.getRequestURI(), exception.getMessage(), exception);
        return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "DOCUMENT_INTERNAL_ERROR", "Unexpected server error.", request, List.of());
    }

    private ResponseEntity<ApiErrorResponseDto> buildErrorResponse(HttpStatus status, String code, String message, HttpServletRequest request, List<FieldErrorResponseDto> fieldErrors) {
        ApiErrorResponseDto response = new ApiErrorResponseDto(
            OffsetDateTime.now(),
            requestIdProvider.getCurrentRequestId(),
            status.value(),
            code,
            message,
            request.getRequestURI(),
            fieldErrors
        );
        return ResponseEntity.status(status).body(response);
    }

    private FieldErrorResponseDto toFieldErrorResponseDto(FieldError fieldError) {
        return new FieldErrorResponseDto(fieldError.getField(), fieldError.getCode(), fieldError.getDefaultMessage());
    }
}

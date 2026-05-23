package dev.mediaservice.controller.exceptionhandler;

import dev.mediaservice.exception.MediaAccessDeniedException;
import dev.mediaservice.exception.MediaDependencyUnavailableException;
import dev.mediaservice.exception.MediaFileNotFoundException;
import dev.mediaservice.exception.MediaFileValidationException;
import dev.mediaservice.exception.MediaStorageException;
import dev.mediaservice.exception.TokenValidationException;
import dev.mediaservice.model.dto.error.ApiErrorResponseDto;
import dev.mediaservice.model.dto.error.FieldErrorResponseDto;
import dev.mediaservice.observability.RequestIdProvider;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class AppExceptionHandler {
    private final RequestIdProvider requestIdProvider;

    @ExceptionHandler(MediaFileNotFoundException.class)
    public ResponseEntity<ApiErrorResponseDto> handleMediaFileNotFoundException(
        MediaFileNotFoundException exception,
        HttpServletRequest request
    ) {
        log.warn("Media file was not found. message={}", exception.getMessage());
        return buildErrorResponse(HttpStatus.NOT_FOUND, "MEDIA_FILE_NOT_FOUND", exception.getMessage(), request, List.of());
    }

    @ExceptionHandler(MediaAccessDeniedException.class)
    public ResponseEntity<ApiErrorResponseDto> handleMediaAccessDeniedException(
        MediaAccessDeniedException exception,
        HttpServletRequest request
    ) {
        log.warn("Media access was denied. message={}", exception.getMessage());
        return buildErrorResponse(HttpStatus.FORBIDDEN, "MEDIA_ACCESS_DENIED", exception.getMessage(), request, List.of());
    }

    @ExceptionHandler(TokenValidationException.class)
    public ResponseEntity<ApiErrorResponseDto> handleTokenValidationException(
        TokenValidationException exception,
        HttpServletRequest request
    ) {
        log.warn("JWT validation failed. message={}", exception.getMessage());
        return buildErrorResponse(HttpStatus.UNAUTHORIZED, "TOKEN_VALIDATION_FAILED", "Authentication token is invalid.", request, List.of());
    }


    @ExceptionHandler(MediaFileValidationException.class)
    public ResponseEntity<ApiErrorResponseDto> handleMediaFileValidationException(
        MediaFileValidationException exception,
        HttpServletRequest request
    ) {
        log.warn("Encrypted media file validation failed. message={}", exception.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "MEDIA_FILE_VALIDATION_FAILED", exception.getMessage(), request, List.of());
    }

    @ExceptionHandler(MediaDependencyUnavailableException.class)
    public ResponseEntity<ApiErrorResponseDto> handleMediaDependencyUnavailableException(
        MediaDependencyUnavailableException exception,
        HttpServletRequest request
    ) {
        log.warn("Media dependency is unavailable. message={}", exception.getMessage());
        return buildErrorResponse(HttpStatus.BAD_GATEWAY, "MEDIA_DEPENDENCY_UNAVAILABLE", exception.getMessage(), request, List.of());
    }

    @ExceptionHandler(MediaStorageException.class)
    public ResponseEntity<ApiErrorResponseDto> handleMediaStorageException(
        MediaStorageException exception,
        HttpServletRequest request
    ) {
        log.warn("Media storage operation failed. message={}", exception.getMessage());
        return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "MEDIA_STORAGE_ERROR", "Encrypted media storage operation failed.", request, List.of());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponseDto> handleMaxUploadSizeExceededException(
        HttpServletRequest request
    ) {
        log.warn("Multipart upload size limit was exceeded.");
        return buildErrorResponse(HttpStatus.CONTENT_TOO_LARGE, "MEDIA_FILE_TOO_LARGE", "Encrypted file exceeds maximum allowed size.", request, List.of());
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiErrorResponseDto> handleMissingServletRequestPartException(
        MissingServletRequestPartException exception,
        HttpServletRequest request
    ) {
        log.warn("Required multipart request part is missing. partName={}", exception.getRequestPartName());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "REQUEST_PART_MISSING", exception.getMessage(), request, List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponseDto> handleMethodArgumentNotValidException(
        MethodArgumentNotValidException exception,
        HttpServletRequest request
    ) {
        List<FieldErrorResponseDto> fieldErrors = exception.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(this::toFieldErrorResponse)
            .toList();
        log.warn("Request validation failed. fieldErrorCount={}", fieldErrors.size());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request validation failed.", request, fieldErrors);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponseDto> handleException(
        Exception exception,
        HttpServletRequest request
    ) {
        log.error("Unexpected media-service error occurred. message={}", exception.getMessage(), exception);
        return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR", "Unexpected server error.", request, List.of());
    }

    private ResponseEntity<ApiErrorResponseDto> buildErrorResponse(
        HttpStatus status,
        String code,
        String message,
        HttpServletRequest request,
        List<FieldErrorResponseDto> fieldErrors
    ) {
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

    private FieldErrorResponseDto toFieldErrorResponse(FieldError fieldError) {
        String code = fieldError.getCode() == null ? "INVALID_FIELD" : fieldError.getCode();
        return new FieldErrorResponseDto(fieldError.getField(), code, fieldError.getDefaultMessage());
    }
}

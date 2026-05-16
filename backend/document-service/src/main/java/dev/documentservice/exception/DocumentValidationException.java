package dev.documentservice.exception;

public class DocumentValidationException extends RuntimeException {
    public DocumentValidationException(String message) {
        super(message);
    }

    public DocumentValidationException(String message, Throwable throwable) {
        super(message, throwable);
    }
}

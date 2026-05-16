package dev.documentservice.exception;

public class DocumentAlreadySignedException extends RuntimeException {
    public DocumentAlreadySignedException(String message) {
        super(message);
    }
}

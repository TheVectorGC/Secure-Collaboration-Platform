package dev.documentservice.exception;

public class DocumentRejectedException extends RuntimeException {
    public DocumentRejectedException(String message) {
        super(message);
    }
}

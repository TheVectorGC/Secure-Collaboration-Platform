package dev.messagingservice.exception;

public class DuplicateClientMessageException extends RuntimeException {
    public DuplicateClientMessageException(String message) {
        super(message);
    }
}

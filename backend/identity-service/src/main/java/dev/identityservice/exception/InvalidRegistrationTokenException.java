package dev.identityservice.exception;

public class InvalidRegistrationTokenException extends RuntimeException {
    public InvalidRegistrationTokenException(String message) {
        super(message);
    }

    public InvalidRegistrationTokenException(String message, Throwable throwable) {
        super(message, throwable);
    }
}

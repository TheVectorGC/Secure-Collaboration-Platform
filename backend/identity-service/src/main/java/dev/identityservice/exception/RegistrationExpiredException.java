package dev.identityservice.exception;

public class RegistrationExpiredException extends RuntimeException {
    public RegistrationExpiredException(String message) {
        super(message);
    }

    public RegistrationExpiredException(String message, Throwable throwable) {
        super(message, throwable);
    }
}

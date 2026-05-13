package dev.identityservice.exception;

public class RegistrationAlreadyCompletedException extends RuntimeException {
    public RegistrationAlreadyCompletedException(String message) {
        super(message);
    }

    public RegistrationAlreadyCompletedException(String message, Throwable throwable) {
        super(message, throwable);
    }
}

package dev.identityservice.exception;

public class RegistrationAlreadyCompletedException extends RuntimeException {
    public RegistrationAlreadyCompletedException(String message) {
        super(message);
    }
}

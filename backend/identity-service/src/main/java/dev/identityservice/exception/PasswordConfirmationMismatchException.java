package dev.identityservice.exception;

public class PasswordConfirmationMismatchException extends RuntimeException {
    public PasswordConfirmationMismatchException(String message) {
        super(message);
    }
}

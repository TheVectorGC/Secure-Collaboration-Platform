package dev.identityservice.exception;

public class PasswordConfirmationMismatchException extends RuntimeException {
    public PasswordConfirmationMismatchException(String message) {
        super(message);
    }

    public PasswordConfirmationMismatchException(String message, Throwable throwable) {
        super(message, throwable);
    }
}

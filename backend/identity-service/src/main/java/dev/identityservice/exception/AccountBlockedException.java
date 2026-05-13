package dev.identityservice.exception;

public class AccountBlockedException extends RuntimeException {
    public AccountBlockedException(String message) {
        super(message);
    }

    public AccountBlockedException(String message, Throwable throwable) {
        super(message, throwable);
    }
}

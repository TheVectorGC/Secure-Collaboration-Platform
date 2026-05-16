package dev.documentservice.exception;

public class SigningKeyNotFoundException extends RuntimeException {
    public SigningKeyNotFoundException(String message) {
        super(message);
    }
}

package dev.identityservice.exception;

public class TokenSigningException extends RuntimeException {
    public TokenSigningException(String message) {
        super(message);
    }

    public TokenSigningException(String message, Throwable throwable) {
        super(message, throwable);
    }
}

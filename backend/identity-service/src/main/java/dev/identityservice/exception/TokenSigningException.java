package dev.identityservice.exception;

public class TokenSigningException extends RuntimeException {

    public TokenSigningException(String message, Throwable throwable) {
        super(message, throwable);
    }
}

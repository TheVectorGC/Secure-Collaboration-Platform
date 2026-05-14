package dev.realtimegateway.exception;

public class TokenValidationException extends RuntimeException {
    public TokenValidationException(String message) {
        super(message);
    }

    public TokenValidationException(String message, Throwable throwable) {
        super(message, throwable);
    }
}

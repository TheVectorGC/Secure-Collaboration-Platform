package dev.realtimegateway.exception;

public class WebSocketAuthenticationException extends RuntimeException {
    public WebSocketAuthenticationException(String message) {
        super(message);
    }

    public WebSocketAuthenticationException(String message, Throwable throwable) {
        super(message, throwable);
    }
}

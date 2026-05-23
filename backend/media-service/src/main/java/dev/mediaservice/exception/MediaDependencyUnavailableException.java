package dev.mediaservice.exception;

public class MediaDependencyUnavailableException extends RuntimeException {
    public MediaDependencyUnavailableException(String message) {
        super(message);
    }

    public MediaDependencyUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}

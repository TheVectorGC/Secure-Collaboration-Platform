package dev.messagingservice.exception;

public class DeviceDirectoryUnavailableException extends RuntimeException {
    public DeviceDirectoryUnavailableException(String message) {
        super(message);
    }

    public DeviceDirectoryUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}

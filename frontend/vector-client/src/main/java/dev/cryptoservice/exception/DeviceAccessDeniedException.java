package dev.cryptoservice.exception;

public class DeviceAccessDeniedException extends RuntimeException {
    public DeviceAccessDeniedException(String message) {
        super(message);
    }
}

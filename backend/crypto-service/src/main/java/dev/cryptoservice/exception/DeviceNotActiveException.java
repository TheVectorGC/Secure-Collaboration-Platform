package dev.cryptoservice.exception;

public class DeviceNotActiveException extends RuntimeException {
    public DeviceNotActiveException(String message) {
        super(message);
    }
}

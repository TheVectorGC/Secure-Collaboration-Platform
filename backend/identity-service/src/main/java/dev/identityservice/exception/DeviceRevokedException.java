package dev.identityservice.exception;

public class DeviceRevokedException extends RuntimeException {
    public DeviceRevokedException(String message) {
        super(message);
    }
}
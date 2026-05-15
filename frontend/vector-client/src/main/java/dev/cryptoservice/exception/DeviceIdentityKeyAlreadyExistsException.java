package dev.cryptoservice.exception;

public class DeviceIdentityKeyAlreadyExistsException extends RuntimeException {
    public DeviceIdentityKeyAlreadyExistsException(String message) {
        super(message);
    }
}

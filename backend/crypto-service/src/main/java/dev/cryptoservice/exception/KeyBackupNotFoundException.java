package dev.cryptoservice.exception;

public class KeyBackupNotFoundException extends RuntimeException {
    public KeyBackupNotFoundException(String message) {
        super(message);
    }
}

package dev.cryptoservice.exception;

public class AccountBackupProfileNotFoundException extends RuntimeException {
    public AccountBackupProfileNotFoundException(String message) {
        super(message);
    }
}

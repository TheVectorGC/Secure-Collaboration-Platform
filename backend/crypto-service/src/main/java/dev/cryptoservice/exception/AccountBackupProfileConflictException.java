package dev.cryptoservice.exception;

public class AccountBackupProfileConflictException extends RuntimeException {
    public AccountBackupProfileConflictException(String message) {
        super(message);
    }
}

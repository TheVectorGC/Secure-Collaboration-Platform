package dev.cryptoservice.exception;

public class OneTimePreKeyAlreadyExistsException extends RuntimeException {
    public OneTimePreKeyAlreadyExistsException(String message) {
        super(message);
    }
}

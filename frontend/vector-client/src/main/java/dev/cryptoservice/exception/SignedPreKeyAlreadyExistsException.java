package dev.cryptoservice.exception;

public class SignedPreKeyAlreadyExistsException extends RuntimeException {
    public SignedPreKeyAlreadyExistsException(String message) {
        super(message);
    }
}

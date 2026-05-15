package dev.cryptoservice.exception;

public class SignedPreKeyNotFoundException extends RuntimeException {
    public SignedPreKeyNotFoundException(String message) {
        super(message);
    }
}

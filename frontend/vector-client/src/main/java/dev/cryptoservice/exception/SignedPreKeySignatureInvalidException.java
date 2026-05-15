package dev.cryptoservice.exception;

public class SignedPreKeySignatureInvalidException extends RuntimeException {
    public SignedPreKeySignatureInvalidException(String message) {
        super(message);
    }
}

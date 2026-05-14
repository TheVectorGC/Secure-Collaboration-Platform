package dev.cryptoservice.exception;

public class CryptoKeyValidationException extends RuntimeException {
    public CryptoKeyValidationException(String message) {
        super(message);
    }

    public CryptoKeyValidationException(String message, Throwable throwable) {
        super(message, throwable);
    }
}

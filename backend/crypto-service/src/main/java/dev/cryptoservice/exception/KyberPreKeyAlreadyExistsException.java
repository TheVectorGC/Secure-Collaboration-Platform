package dev.cryptoservice.exception;

public class KyberPreKeyAlreadyExistsException extends RuntimeException {
    public KyberPreKeyAlreadyExistsException(String message) {
        super(message);
    }
}

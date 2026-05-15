package dev.messagingservice.exception;

public class MessagePayloadValidationException extends RuntimeException {
    public MessagePayloadValidationException(String message) {
        super(message);
    }
}

package dev.messagingservice.model.enumeration;

public enum MessageType {
    TEXT("текст");

    private final String displayName;

    MessageType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

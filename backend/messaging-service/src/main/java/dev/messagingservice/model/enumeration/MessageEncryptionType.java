package dev.messagingservice.model.enumeration;

public enum MessageEncryptionType {
    SIGNAL("Signal");

    private final String displayName;

    MessageEncryptionType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

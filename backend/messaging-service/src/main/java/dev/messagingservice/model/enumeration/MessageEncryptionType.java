package dev.messagingservice.model.enumeration;

public enum MessageEncryptionType {
    CONTENT("Content key"),
    GROUP("Group epoch key"),
    NONE("None");

    private final String displayName;

    MessageEncryptionType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}


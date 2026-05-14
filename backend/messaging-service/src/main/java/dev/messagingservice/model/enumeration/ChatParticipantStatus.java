package dev.messagingservice.model.enumeration;

public enum ChatParticipantStatus {
    ACTIVE("активен"),
    LEFT("покинул");

    private final String displayName;

    ChatParticipantStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

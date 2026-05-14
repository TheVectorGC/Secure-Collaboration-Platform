package dev.messagingservice.model.enumeration;

public enum ChatParticipantRole {
    OWNER("владелец"),
    MEMBER("участник");

    private final String displayName;

    ChatParticipantRole(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

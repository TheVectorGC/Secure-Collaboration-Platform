package dev.messagingservice.model.enumeration;

public enum GroupHistoryAccessMode {
    FULL_HISTORY("вся история"),
    NEW_MESSAGES_ONLY("только новые сообщения"),
    FROM_MESSAGE("с выбранного сообщения");

    private final String displayName;

    GroupHistoryAccessMode(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

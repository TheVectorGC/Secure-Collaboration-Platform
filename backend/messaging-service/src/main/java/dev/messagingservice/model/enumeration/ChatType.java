package dev.messagingservice.model.enumeration;

public enum ChatType {
    DIRECT("личный чат"),
    SELF("избранное");

    private final String displayName;

    ChatType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

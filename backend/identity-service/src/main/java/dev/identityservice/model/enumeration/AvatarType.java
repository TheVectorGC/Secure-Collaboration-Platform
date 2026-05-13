package dev.identityservice.model.enumeration;

public enum AvatarType {
    AUTO("автоматический"),
    UPLOADED("загруженный");

    private final String displayName;

    AvatarType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

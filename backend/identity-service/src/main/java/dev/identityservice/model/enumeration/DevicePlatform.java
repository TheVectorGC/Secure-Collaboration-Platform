package dev.identityservice.model.enumeration;

public enum DevicePlatform {
    WINDOWS("Windows");

    private final String displayName;

    DevicePlatform(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
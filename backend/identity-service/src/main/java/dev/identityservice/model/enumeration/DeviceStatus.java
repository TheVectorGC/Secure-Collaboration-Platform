package dev.identityservice.model.enumeration;

public enum DeviceStatus {
    ACTIVE("активно"),
    REVOKED("отозвано");

    private final String displayName;

    DeviceStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
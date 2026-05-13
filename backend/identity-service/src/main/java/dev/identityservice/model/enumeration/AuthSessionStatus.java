package dev.identityservice.model.enumeration;

public enum AuthSessionStatus {
    ACTIVE("активна"),
    ROTATED("ротирована"),
    REVOKED("отозвана"),
    EXPIRED("истекла");

    private final String displayName;

    AuthSessionStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

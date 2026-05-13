package dev.identityservice.model.enumeration;

public enum AccountStatus {
    ACTIVE("активен"),
    BLOCKED("заблокирован");

    private final String displayName;

    AccountStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

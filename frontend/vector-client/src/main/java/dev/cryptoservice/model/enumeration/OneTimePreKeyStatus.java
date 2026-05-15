package dev.cryptoservice.model.enumeration;

public enum OneTimePreKeyStatus {
    AVAILABLE("доступен"),
    CONSUMED("использован"),
    EXPIRED("истёк");

    private final String displayName;

    OneTimePreKeyStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

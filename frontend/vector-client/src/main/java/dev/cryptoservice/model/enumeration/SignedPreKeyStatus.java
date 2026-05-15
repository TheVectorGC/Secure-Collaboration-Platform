package dev.cryptoservice.model.enumeration;

public enum SignedPreKeyStatus {
    ACTIVE("активен"),
    REPLACED("заменён"),
    EXPIRED("истёк");

    private final String displayName;

    SignedPreKeyStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

package dev.cryptoservice.model.enumeration;

public enum KyberPreKeyStatus {
    ACTIVE("активен"),
    REPLACED("заменён"),
    USED("использован"),
    EXPIRED("истёк");

    private final String displayName;

    KyberPreKeyStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

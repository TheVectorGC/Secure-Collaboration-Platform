package dev.identityservice.model.enumeration;

public enum AccountRole {
    USER("пользователь"),
    ADMIN("администратор");

    private final String displayName;

    AccountRole(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

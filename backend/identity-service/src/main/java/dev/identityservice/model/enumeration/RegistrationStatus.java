package dev.identityservice.model.enumeration;

public enum RegistrationStatus {
    PENDING("ожидает"),
    COMPLETED("завершена"),
    EXPIRED("истекла"),
    CANCELLED("отменена");

    private final String displayName;

    RegistrationStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

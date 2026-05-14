package dev.messagingservice.model.enumeration;

public enum MessageDeliveryStatus {
    SENT("отправлено"),
    DELIVERED("доставлено"),
    READ("прочитано");

    private final String displayName;

    MessageDeliveryStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

package dev.messagingservice.model.enumeration;

public enum MessageType {
    TEXT("текст"),
    FILE("файл"),
    IMAGE("изображение"),
    SYSTEM("системное сообщение");

    private final String displayName;

    MessageType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

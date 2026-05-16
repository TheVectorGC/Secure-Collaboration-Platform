package dev.messagingservice.model.enumeration;

public enum MessageType {
    TEXT("текст"),
    FILE("файл"),
    IMAGE("изображение"),
    GROUP_KEY_DISTRIBUTION("пакет группового ключа"),
    SYSTEM("системное сообщение");

    private final String displayName;

    MessageType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

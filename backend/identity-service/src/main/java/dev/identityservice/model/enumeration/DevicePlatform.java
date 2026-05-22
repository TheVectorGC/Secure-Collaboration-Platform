package dev.identityservice.model.enumeration;

public enum DevicePlatform {
    WINDOWS("Windows"),
    MACOS("macOS"),
    LINUX("Linux"),
    ANDROID("Android"),
    IOS("iOS"),
    WEB("Web");

    private final String displayName;

    DevicePlatform(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

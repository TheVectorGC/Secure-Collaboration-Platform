package dev.messagingservice.util;

public final class TextNormalizer {
    private TextNormalizer() {
    }

    public static String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }

        return value.trim();
    }
}

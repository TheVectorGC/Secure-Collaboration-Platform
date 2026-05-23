package dev.cryptoservice.util;

public final class TextNormalizer {
    private TextNormalizer() {
    }

    public static String trimRequired(String value) {
        if (value == null) {
            return null;
        }

        return value.trim();
    }
}

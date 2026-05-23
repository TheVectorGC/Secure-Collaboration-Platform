package dev.identityservice.util;

public final class StringNormalizer {
    private StringNormalizer() {}

    public static String trimToNull(String value) {
        if (value == null) {
            return null;
        }

        String trimmedValue = value.trim();

        if (trimmedValue.isEmpty()) {
            return null;
        }

        return trimmedValue;
    }

    public static String normalizeEmail(String email) {
        String trimmedEmail = trimToNull(email);

        if (trimmedEmail == null) {
            return null;
        }

        return trimmedEmail.toLowerCase();
    }

    public static String normalizeFingerprint(String fingerprint) {
        String trimmedFingerprint = trimToNull(fingerprint);

        if (trimmedFingerprint == null) {
            return null;
        }

        return trimmedFingerprint.replace(":", "").replace(" ", "").toUpperCase();
    }
}

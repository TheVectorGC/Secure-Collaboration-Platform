package dev.documentservice.util;

import java.security.MessageDigest;
import java.util.HexFormat;

public final class HashUtils {
    public static String sha256Hex(byte[] value) {
        try {
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(messageDigest.digest(value));
        }
        catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }

    private HashUtils() {}
}

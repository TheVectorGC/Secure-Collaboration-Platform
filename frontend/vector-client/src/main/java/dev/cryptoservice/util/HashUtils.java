package dev.cryptoservice.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public class HashUtils {
    public static String sha256Hex(String value) {
        return sha256Hex(value.getBytes(StandardCharsets.UTF_8));
    }

    public static String sha256Hex(byte[] value) {
        try {
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            byte[] hash = messageDigest.digest(value);
            return HexFormat.of().formatHex(hash);
        }
        catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 algorithm is not available.", exception);
        }
    }

    private HashUtils() {}
}

package dev.documentservice.util;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

public final class Base64UrlUtils {
    private Base64UrlUtils() {
    }

    public static byte[] decode(String value) {
        return Base64.getUrlDecoder().decode(value);
    }

    public static String decodeToString(String value) {
        return new String(decode(value), StandardCharsets.UTF_8);
    }
}

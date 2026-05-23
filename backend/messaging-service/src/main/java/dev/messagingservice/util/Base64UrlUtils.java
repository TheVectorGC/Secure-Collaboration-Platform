package dev.messagingservice.util;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

public class Base64UrlUtils {
    private static final Base64.Decoder BASE64_URL_DECODER = Base64.getUrlDecoder();

    public static byte[] decode(String value) {
        return BASE64_URL_DECODER.decode(value);
    }

    public static String decodeToString(String value) {
        return new String(decode(value), StandardCharsets.UTF_8);
    }

    private Base64UrlUtils() {}
}

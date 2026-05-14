package dev.messagingservice.util;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

public class Base64UrlUtils {
    private static final Base64.Encoder BASE64_URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder BASE64_URL_DECODER = Base64.getUrlDecoder();

    public static String encodeToString(byte[] bytes) {
        return BASE64_URL_ENCODER.encodeToString(bytes);
    }

    public static String encodeToString(String value) {
        return BASE64_URL_ENCODER.encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    public static byte[] decode(String value) {
        return BASE64_URL_DECODER.decode(value);
    }

    public static String decodeToString(String value) {
        return new String(decode(value), StandardCharsets.UTF_8);
    }

    private Base64UrlUtils() {}
}

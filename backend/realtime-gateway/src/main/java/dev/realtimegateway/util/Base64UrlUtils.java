package dev.realtimegateway.util;

import java.util.Base64;

public class Base64UrlUtils {

    public static byte[] decode(String value) {
        return Base64.getUrlDecoder().decode(value);
    }

    private Base64UrlUtils() {}
}

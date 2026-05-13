package dev.identityservice.util;

import java.security.SecureRandom;

public class SecureTokenGenerator {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES_LENGTH = 48;

    public static String generateToken() {
        byte[] tokenBytes = new byte[TOKEN_BYTES_LENGTH];
        SECURE_RANDOM.nextBytes(tokenBytes);
        return Base64UrlUtils.encodeToString(tokenBytes);
    }

    private SecureTokenGenerator() {}
}

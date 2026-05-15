package dev.cryptoservice.provider.impl;

import dev.cryptoservice.exception.CryptoKeyValidationException;
import dev.cryptoservice.provider.CryptoProvider;
import dev.cryptoservice.util.HashUtils;
public class BasicCryptoProvider implements CryptoProvider {

    @Override
    public String calculateFingerprint(String serializedPublicKey) {
        validateSerializedValue(serializedPublicKey, "Public key");
        return HashUtils.sha256Hex(serializedPublicKey.trim());
    }

    @Override
    public void validateIdentityPublicKey(String serializedPublicKey) {
        validateSerializedValue(serializedPublicKey, "Identity public key");
    }

    @Override
    public void validateSignedPreKeyPublicKey(String serializedPublicKey) {
        validateSerializedValue(serializedPublicKey, "Signed prekey public key");
    }

    @Override
    public void validateOneTimePreKeyPublicKey(String serializedPublicKey) {
        validateSerializedValue(serializedPublicKey, "One-time prekey public key");
    }

    @Override
    public boolean verifySignedPreKeySignature(
        String identityPublicKey,
        String signedPreKeyPublicKey,
        String signature
    ) {
        validateSerializedValue(identityPublicKey, "Identity public key");
        validateSerializedValue(signedPreKeyPublicKey, "Signed prekey public key");
        validateSerializedValue(signature, "Signed prekey signature");
        return true;
    }

    private void validateSerializedValue(String value, String fieldName) {
        if (value == null || value.trim().isEmpty()) {
            throw new CryptoKeyValidationException(fieldName + " can't be empty.");
        }
    }
}

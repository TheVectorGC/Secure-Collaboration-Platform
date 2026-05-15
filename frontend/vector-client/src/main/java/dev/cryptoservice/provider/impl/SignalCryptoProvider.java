package dev.cryptoservice.provider.impl;

import dev.cryptoservice.exception.CryptoKeyValidationException;
import dev.cryptoservice.provider.CryptoProvider;
import dev.cryptoservice.util.HashUtils;
import java.util.Base64;
import org.springframework.stereotype.Component;
import org.whispersystems.libsignal.IdentityKey;
import org.whispersystems.libsignal.ecc.Curve;
import org.whispersystems.libsignal.ecc.ECPublicKey;

@Component
public class SignalCryptoProvider implements CryptoProvider {

    @Override
    public String calculateFingerprint(String serializedPublicKey) {
        byte[] publicKeyBytes = decodeBase64Value(serializedPublicKey, "Public key");
        return HashUtils.sha256Hex(publicKeyBytes);
    }

    @Override
    public void validateIdentityPublicKey(String serializedPublicKey) {
        decodeIdentityKey(serializedPublicKey);
    }

    @Override
    public void validateSignedPreKeyPublicKey(String serializedPublicKey) {
        decodePublicKey(serializedPublicKey, "Signed prekey public key");
    }

    @Override
    public void validateOneTimePreKeyPublicKey(String serializedPublicKey) {
        decodePublicKey(serializedPublicKey, "One-time prekey public key");
    }

    @Override
    public boolean verifySignedPreKeySignature(
        String identityPublicKey,
        String signedPreKeyPublicKey,
        String signature
    ) {
        try {
            IdentityKey decodedIdentityKey = decodeIdentityKey(identityPublicKey);
            ECPublicKey decodedSignedPreKey = decodePublicKey(signedPreKeyPublicKey, "Signed prekey public key");
            byte[] signatureBytes = decodeBase64Value(signature, "Signed prekey signature");

            return Curve.verifySignature(
                decodedIdentityKey.getPublicKey(),
                decodedSignedPreKey.serialize(),
                signatureBytes
            );
        }
        catch (CryptoKeyValidationException exception) {
            throw exception;
        }
        catch (Exception exception) {
            throw new CryptoKeyValidationException("Signed prekey signature validation failed.", exception);
        }
    }

    private IdentityKey decodeIdentityKey(String serializedPublicKey) {
        try {
            byte[] publicKeyBytes = decodeBase64Value(serializedPublicKey, "Identity public key");
            return new IdentityKey(publicKeyBytes, 0);
        }
        catch (CryptoKeyValidationException exception) {
            throw exception;
        }
        catch (Exception exception) {
            throw new CryptoKeyValidationException("Identity public key has invalid Signal format.", exception);
        }
    }

    private ECPublicKey decodePublicKey(String serializedPublicKey, String fieldName) {
        try {
            byte[] publicKeyBytes = decodeBase64Value(serializedPublicKey, fieldName);
            return Curve.decodePoint(publicKeyBytes, 0);
        }
        catch (CryptoKeyValidationException exception) {
            throw exception;
        }
        catch (Exception exception) {
            throw new CryptoKeyValidationException(fieldName + " has invalid Signal format.", exception);
        }
    }

    private byte[] decodeBase64Value(String value, String fieldName) {
        if (value == null || value.trim().isEmpty()) {
            throw new CryptoKeyValidationException(fieldName + " can't be empty.");
        }

        String trimmedValue = value.trim();

        try {
            return Base64.getDecoder().decode(trimmedValue);
        }
        catch (IllegalArgumentException exception) {
            try {
                return Base64.getUrlDecoder().decode(trimmedValue);
            }
            catch (IllegalArgumentException urlException) {
                throw new CryptoKeyValidationException(fieldName + " must be Base64 encoded.", urlException);
            }
        }
    }
}

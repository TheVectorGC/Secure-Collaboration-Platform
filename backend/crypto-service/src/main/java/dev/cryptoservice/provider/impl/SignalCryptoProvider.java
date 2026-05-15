package dev.cryptoservice.provider.impl;

import dev.cryptoservice.exception.CryptoKeyValidationException;
import dev.cryptoservice.provider.CryptoProvider;
import dev.cryptoservice.util.HashUtils;
import java.util.Base64;
import org.springframework.stereotype.Component;
import org.whispersystems.libsignal.IdentityKey;
import org.whispersystems.libsignal.InvalidKeyException;
import org.whispersystems.libsignal.ecc.Curve;
import org.whispersystems.libsignal.ecc.ECPublicKey;

@Component
public class SignalCryptoProvider implements CryptoProvider {

    @Override
    public String calculateFingerprint(String serializedPublicKey) {
        byte[] decodedPublicKey = decodeSerializedValue(serializedPublicKey);
        return HashUtils.sha256Hex(decodedPublicKey);
    }

    @Override
    public void validateIdentityPublicKey(String serializedPublicKey) {
        decodeIdentityKey(serializedPublicKey);
    }

    @Override
    public void validateSignedPreKeyPublicKey(String serializedPublicKey) {
        decodePublicKey(serializedPublicKey);
    }

    @Override
    public void validateKyberPreKeyPublicKey(String serializedPublicKey) {
        decodeSerializedValue(serializedPublicKey);
    }

    @Override
    public void validateOneTimePreKeyPublicKey(String serializedPublicKey) {
        decodePublicKey(serializedPublicKey);
    }

    @Override
    public boolean verifySignedPreKeySignature(
            String identityPublicKey,
            String signedPreKeyPublicKey,
            String signature
    ) {
        try {
            IdentityKey decodedIdentityKey = decodeIdentityKey(identityPublicKey);
            ECPublicKey decodedSignedPreKeyPublicKey = decodePublicKey(signedPreKeyPublicKey);
            byte[] decodedSignature = decodeSerializedValue(signature);

            return Curve.verifySignature(
                    decodedIdentityKey.getPublicKey(),
                    decodedSignedPreKeyPublicKey.serialize(),
                    decodedSignature
            );
        }
        catch (InvalidKeyException exception) {
            throw new CryptoKeyValidationException("Signed prekey signature validation failed.", exception);
        }
    }

    @Override
    public boolean verifyKyberPreKeySignature(
            String identityPublicKey,
            String kyberPreKeyPublicKey,
            String signature
    ) {
        try {
            IdentityKey decodedIdentityKey = decodeIdentityKey(identityPublicKey);
            byte[] decodedKyberPreKeyPublicKey = decodeSerializedValue(kyberPreKeyPublicKey);
            byte[] decodedSignature = decodeSerializedValue(signature);

            return Curve.verifySignature(
                    decodedIdentityKey.getPublicKey(),
                    decodedKyberPreKeyPublicKey,
                    decodedSignature
            );
        }
        catch (InvalidKeyException exception) {
            throw new CryptoKeyValidationException("Kyber prekey signature validation failed.", exception);
        }
    }

    private IdentityKey decodeIdentityKey(String serializedPublicKey) {
        try {
            return new IdentityKey(decodeSerializedValue(serializedPublicKey), 0);
        }
        catch (InvalidKeyException exception) {
            throw new CryptoKeyValidationException("Identity public key is invalid.", exception);
        }
    }

    private ECPublicKey decodePublicKey(String serializedPublicKey) {
        try {
            return Curve.decodePoint(decodeSerializedValue(serializedPublicKey), 0);
        }
        catch (InvalidKeyException exception) {
            throw new CryptoKeyValidationException("Public key is invalid.", exception);
        }
    }

    private byte[] decodeSerializedValue(String serializedValue) {
        if (serializedValue == null || serializedValue.trim().isEmpty()) {
            throw new CryptoKeyValidationException("Serialized crypto value can't be empty.");
        }

        String normalizedSerializedValue = serializedValue.trim();

        try {
            return Base64.getDecoder().decode(normalizedSerializedValue);
        }
        catch (IllegalArgumentException exception) {
            try {
                return Base64.getUrlDecoder().decode(normalizedSerializedValue);
            }
            catch (IllegalArgumentException ignoredException) {
                throw new CryptoKeyValidationException("Serialized crypto value must be Base64 or Base64URL encoded.", exception);
            }
        }
    }
}
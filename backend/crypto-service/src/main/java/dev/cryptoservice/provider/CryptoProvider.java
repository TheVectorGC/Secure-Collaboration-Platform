package dev.cryptoservice.provider;

public interface CryptoProvider {
    String calculateFingerprint(String serializedPublicKey);

    void validateIdentityPublicKey(String serializedPublicKey);

    void validateSignedPreKeyPublicKey(String serializedPublicKey);

    void validateKyberPreKeyPublicKey(String serializedPublicKey);

    void validateOneTimePreKeyPublicKey(String serializedPublicKey);

    boolean verifySignedPreKeySignature(
        String identityPublicKey,
        String signedPreKeyPublicKey,
        String signature
    );

    boolean verifyKyberPreKeySignature(
        String identityPublicKey,
        String kyberPreKeyPublicKey,
        String signature
    );
}

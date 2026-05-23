package dev.documentservice.service.document;

import dev.documentservice.exception.DocumentValidationException;
import dev.documentservice.model.entity.DeviceDocumentSigningKeyEntity;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import org.springframework.stereotype.Component;

@Component
public class DocumentSignatureVerifier {
    public void verifySignature(DeviceDocumentSigningKeyEntity signingKeyEntity, String documentHashBase64, String signatureBase64) {
        try {
            PublicKey publicKey = KeyFactory.getInstance("Ed25519").generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(signingKeyEntity.getPublicKeyBase64())));
            Signature signature = Signature.getInstance("Ed25519");
            signature.initVerify(publicKey);
            signature.update(Base64.getDecoder().decode(documentHashBase64));
            boolean verified = signature.verify(Base64.getDecoder().decode(signatureBase64));
            if (!verified) {
                throw new DocumentValidationException("Document signature is invalid.");
            }
        }
        catch (DocumentValidationException exception) {
            throw exception;
        }
        catch (Exception exception) {
            throw new DocumentValidationException("Failed to verify document signature.", exception);
        }
    }
}

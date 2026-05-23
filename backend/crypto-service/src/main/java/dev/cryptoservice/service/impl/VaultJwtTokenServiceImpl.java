package dev.cryptoservice.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.cryptoservice.properties.JwtProperties;
import dev.cryptoservice.exception.TokenValidationException;
import dev.cryptoservice.service.JwtTokenService;
import dev.cryptoservice.util.Base64UrlUtils;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.vault.core.VaultOperations;
import org.springframework.vault.support.Plaintext;
import org.springframework.vault.support.Signature;

@Slf4j
@Service
@RequiredArgsConstructor
public class VaultJwtTokenServiceImpl implements JwtTokenService {
    private static final String VAULT_SIGNATURE_PREFIX = "vault:v1:";

    private final VaultOperations vaultOperations;
    private final ObjectMapper objectMapper;
    private final JwtProperties jwtProperties;

    @Override
    public boolean validateToken(String token) {
        Map<String, Object> claims = extractClaims(token);
        Object issuer = claims.get("iss");
        Number expiresAt = (Number) claims.get("exp");
        long currentEpochSecond = OffsetDateTime.now().toEpochSecond();

        return jwtProperties.issuer().equals(String.valueOf(issuer))
            && expiresAt.longValue() > currentEpochSecond
            && verify(token);
    }

    @Override
    public String extractUsername(String token) {
        Map<String, Object> claims = extractClaims(token);
        return String.valueOf(claims.get("sub"));
    }

    @Override
    public Map<String, Object> extractClaims(String token) {
        try {
            String[] tokenParts = token.split("\\.");

            if (tokenParts.length != 3) {
                throw new TokenValidationException("JWT token format is invalid.");
            }

            String payloadJson = Base64UrlUtils.decodeToString(tokenParts[1]);
            return objectMapper.readValue(payloadJson, new TypeReference<>() {});
        }
        catch (RuntimeException exception) {
            throw exception;
        }
        catch (Exception exception) {
            throw new TokenValidationException("Failed to parse JWT token.", exception);
        }
    }

    private boolean verify(String token) {
        try {
            String[] tokenParts = token.split("\\.");
            String signingInput = tokenParts[0] + "." + tokenParts[1];
            byte[] signatureBytes = Base64UrlUtils.decode(tokenParts[2]);
            String vaultSignature = VAULT_SIGNATURE_PREFIX + Base64.getEncoder().encodeToString(signatureBytes);

            Plaintext plaintext = Plaintext.of(signingInput.getBytes(StandardCharsets.UTF_8));
            Signature signature = Signature.of(vaultSignature);

            return vaultOperations.opsForTransit().verify(jwtProperties.keyName(), plaintext, signature);
        }
        catch (Exception exception) {
            log.warn("JWT signature verification failed: {}.", exception.getMessage());
            return false;
        }
    }
}

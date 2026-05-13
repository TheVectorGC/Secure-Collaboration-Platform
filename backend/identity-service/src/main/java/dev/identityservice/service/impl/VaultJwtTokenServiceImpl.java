package dev.identityservice.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.identityservice.config.JwtProperties;
import dev.identityservice.exception.TokenSigningException;
import dev.identityservice.exception.TokenValidationException;
import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.util.Base64UrlUtils;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.vault.core.VaultOperations;
import org.springframework.vault.support.Plaintext;
import org.springframework.vault.support.Signature;
import dev.identityservice.service.JwtTokenService;

@Slf4j
@Service
@RequiredArgsConstructor
public class VaultJwtTokenServiceImpl implements JwtTokenService {
    private static final String JWT_TYPE = "JWT";
    private static final String JWT_ALGORITHM = "EdDSA";
    private static final String VAULT_SIGNATURE_PREFIX = "vault:v1:";

    private final VaultOperations vaultOperations;
    private final ObjectMapper objectMapper;
    private final JwtProperties jwtProperties;

    @Override
    public String generateAccessToken(AccountEntity accountEntity, OffsetDateTime expiresAt) {
        try {
            String header = objectMapper.writeValueAsString(createHeader());
            String payload = objectMapper.writeValueAsString(createPayload(accountEntity, expiresAt));
            String signingInput = Base64UrlUtils.encodeToString(header) + "." + Base64UrlUtils.encodeToString(payload);
            String signature = sign(signingInput);

            return signingInput + "." + signature;
        }
        catch (RuntimeException exception) {
            throw exception;
        }
        catch (Exception exception) {
            throw new TokenSigningException("Failed to generate access token.", exception);
        }
    }

    @Override
    public boolean validateToken(String token, UserDetails userDetails) {
        Map<String, Object> claims = extractClaims(token);
        String username = String.valueOf(claims.get("sub"));
        Number expiresAt = (Number) claims.get("exp");
        long currentEpochSecond = OffsetDateTime.now().toEpochSecond();

        return username.equals(userDetails.getUsername()) && expiresAt.longValue() > currentEpochSecond && verify(token);
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

    private Map<String, Object> createHeader() {
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("typ", JWT_TYPE);
        header.put("alg", JWT_ALGORITHM);
        header.put("kid", jwtProperties.keyName());
        return header;
    }

    private Map<String, Object> createPayload(
            AccountEntity accountEntity,
            OffsetDateTime expiresAt
    ) {
        OffsetDateTime now = OffsetDateTime.now();

        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("iss", jwtProperties.issuer());
        claims.put("sub", accountEntity.getUsername());
        claims.put("accountId", accountEntity.getId().toString());
        claims.put("roles", List.of("ROLE_" + accountEntity.getRole().name()));
        claims.put("iat", now.toEpochSecond());
        claims.put("exp", expiresAt.toEpochSecond());

        return claims;
    }

    private String sign(String signingInput) {
        try {
            Plaintext plaintext = Plaintext.of(signingInput.getBytes(StandardCharsets.UTF_8));
            Signature signature = vaultOperations.opsForTransit().sign(jwtProperties.keyName(), plaintext);
            String vaultSignature = signature.getSignature();
            String rawSignatureBase64 = vaultSignature.substring(vaultSignature.lastIndexOf(":") + 1);
            byte[] rawSignature = Base64.getDecoder().decode(rawSignatureBase64);
            return Base64UrlUtils.encodeToString(rawSignature);
        }
        catch (Exception exception) {
            log.error("Failed to sign JWT with Vault key: {}.", jwtProperties.keyName(), exception);
            throw new TokenSigningException("Failed to sign JWT with Vault.", exception);
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

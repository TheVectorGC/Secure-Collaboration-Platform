package dev.realtimegateway.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.realtimegateway.config.properties.JwtProperties;
import dev.realtimegateway.exception.TokenValidationException;
import dev.realtimegateway.security.AccountPrincipal;
import dev.realtimegateway.service.JwtTokenService;
import dev.realtimegateway.util.Base64UrlUtils;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
    private final VaultOperations vaultOperations;
    private final JwtProperties jwtProperties;
    private final ObjectMapper objectMapper;

    @Override
    public AccountPrincipal validateTokenAndGetPrincipal(String jwtToken) {
        String[] tokenParts = jwtToken.split("\\.");

        if (tokenParts.length != 3) {
            throw new TokenValidationException("JWT token format is invalid.");
        }

        String signingInput = tokenParts[0] + "." + tokenParts[1];

        if (!verifySignature(signingInput, tokenParts[2])) {
            throw new TokenValidationException("JWT token signature is invalid.");
        }

        Map<String, Object> payload = parsePayload(tokenParts[1]);
        validateIssuer(payload);
        validateExpiration(payload);

        return createPrincipal(payload);
    }

    private boolean verifySignature(String signingInput, String signaturePart) {
        try {
            byte[] signatureBytes = Base64UrlUtils.decode(signaturePart);
            String vaultSignatureValue = "vault:v1:" + Base64.getEncoder().encodeToString(signatureBytes);
            Plaintext plaintext = Plaintext.of(signingInput.getBytes(StandardCharsets.UTF_8));
            Signature signature = Signature.of(vaultSignatureValue);
            return vaultOperations.opsForTransit().verify(jwtProperties.keyName(), plaintext, signature);
        }
        catch (Exception exception) {
            log.debug("JWT signature verification failed in Vault.", exception);
            return false;
        }
    }

    private Map<String, Object> parsePayload(String encodedPayload) {
        try {
            byte[] payloadBytes = Base64UrlUtils.decode(encodedPayload);
            return objectMapper.readValue(payloadBytes, new TypeReference<>() {});
        }
        catch (Exception exception) {
            throw new TokenValidationException("JWT token payload is invalid.", exception);
        }
    }

    private void validateIssuer(Map<String, Object> payload) {
        Object issuer = payload.get("iss");

        if (!jwtProperties.issuer().equals(issuer)) {
            throw new TokenValidationException("JWT token issuer is invalid.");
        }
    }

    private void validateExpiration(Map<String, Object> payload) {
        Object expiration = payload.get("exp");

        if (!(expiration instanceof Number expirationNumber)) {
            throw new TokenValidationException("JWT token expiration is missing.");
        }

        if (OffsetDateTime.now().toEpochSecond() >= expirationNumber.longValue()) {
            throw new TokenValidationException("JWT token has expired.");
        }
    }

    private AccountPrincipal createPrincipal(Map<String, Object> payload) {
        String username = String.valueOf(payload.get("sub"));
        UUID accountId = UUID.fromString(String.valueOf(payload.get("accountId")));
        List<String> roles = extractRoles(payload);
        return new AccountPrincipal(accountId, username, roles);
    }

    private List<String> extractRoles(Map<String, Object> payload) {
        Object roles = payload.get("roles");

        if (!(roles instanceof List<?> roleValues)) {
            return List.of();
        }

        return roleValues.stream()
                .map(String::valueOf)
                .toList();
    }
}

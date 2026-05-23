package dev.documentservice.service.impl;

import dev.documentservice.client.IdentityDeviceClient;
import dev.documentservice.exception.DocumentAccessDeniedException;
import dev.documentservice.exception.DocumentValidationException;
import dev.documentservice.mapper.DocumentSigningKeyMapper;
import dev.documentservice.model.dto.request.RegisterDocumentSigningKeyRequestDto;
import dev.documentservice.model.dto.response.DocumentSigningKeyResponseDto;
import dev.documentservice.model.dto.response.InternalDeviceResponseDto;
import dev.documentservice.model.entity.DeviceDocumentSigningKeyEntity;
import dev.documentservice.model.enumeration.DeviceStatus;
import dev.documentservice.model.enumeration.DocumentSigningKeyStatus;
import dev.documentservice.model.enumeration.SignatureAlgorithm;
import dev.documentservice.repository.DeviceDocumentSigningKeyRepository;
import dev.documentservice.service.DocumentSigningKeyService;
import dev.documentservice.util.HashUtils;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentSigningKeyServiceImpl implements DocumentSigningKeyService {
    private final DeviceDocumentSigningKeyRepository deviceDocumentSigningKeyRepository;
    private final IdentityDeviceClient identityDeviceClient;
    private final DocumentSigningKeyMapper documentSigningKeyMapper;

    @Override
    @Transactional
    public DocumentSigningKeyResponseDto registerSigningKey(UUID currentAccountId, UUID deviceId, RegisterDocumentSigningKeyRequestDto requestDto) {
        InternalDeviceResponseDto deviceResponseDto = identityDeviceClient.getDevice(deviceId);
        validateSigningDevice(currentAccountId, deviceResponseDto);
        byte[] publicKeyBytes = decodeAndValidateEd25519PublicKey(requestDto.publicKeyBase64());
        String fingerprint = HashUtils.sha256Hex(publicKeyBytes);
        return deviceDocumentSigningKeyRepository.findByFingerprintAndStatus(fingerprint, DocumentSigningKeyStatus.ACTIVE)
            .map(existingKey -> validateAndReturnExistingKey(currentAccountId, deviceId, existingKey))
            .orElseGet(() -> saveNewSigningKey(currentAccountId, deviceId, requestDto.publicKeyBase64(), fingerprint));
    }

    private void validateSigningDevice(UUID currentAccountId, InternalDeviceResponseDto deviceResponseDto) {
        if (deviceResponseDto == null || !currentAccountId.equals(deviceResponseDto.accountId())) {
            throw new DocumentAccessDeniedException("Document signing key device does not belong to current account.");
        }
        if (deviceResponseDto.status() != DeviceStatus.ACTIVE) {
            throw new DocumentAccessDeniedException("Document signing key device is not active.");
        }
    }

    private DocumentSigningKeyResponseDto validateAndReturnExistingKey(UUID currentAccountId, UUID deviceId, DeviceDocumentSigningKeyEntity existingKey) {
        if (!currentAccountId.equals(existingKey.getAccountId()) || !deviceId.equals(existingKey.getDeviceId())) {
            throw new DocumentAccessDeniedException("Document signing key fingerprint already belongs to another device.");
        }
        return documentSigningKeyMapper.toResponseDto(existingKey);
    }

    private DocumentSigningKeyResponseDto saveNewSigningKey(UUID accountId, UUID deviceId, String publicKeyBase64, String fingerprint) {
        OffsetDateTime now = OffsetDateTime.now();
        DeviceDocumentSigningKeyEntity keyEntity = DeviceDocumentSigningKeyEntity.builder()
            .id(UUID.randomUUID())
            .accountId(accountId)
            .deviceId(deviceId)
            .algorithm(SignatureAlgorithm.ED25519)
            .publicKeyBase64(publicKeyBase64)
            .fingerprint(fingerprint)
            .status(DocumentSigningKeyStatus.ACTIVE)
            .createdAt(now)
            .build();
        DeviceDocumentSigningKeyEntity savedKeyEntity = deviceDocumentSigningKeyRepository.save(keyEntity);
        log.info("Document signing key registered. accountId={} deviceId={} fingerprint={}", accountId, deviceId, fingerprint);
        return documentSigningKeyMapper.toResponseDto(savedKeyEntity);
    }

    private byte[] decodeAndValidateEd25519PublicKey(String publicKeyBase64) {
        try {
            byte[] publicKeyBytes = Base64.getDecoder().decode(publicKeyBase64);
            KeyFactory keyFactory = KeyFactory.getInstance("Ed25519");
            PublicKey publicKey = keyFactory.generatePublic(new X509EncodedKeySpec(publicKeyBytes));
            if (!"EdDSA".equalsIgnoreCase(publicKey.getAlgorithm()) && !"Ed25519".equalsIgnoreCase(publicKey.getAlgorithm())) {
                throw new DocumentValidationException("Document signing public key algorithm is not Ed25519.");
            }
            return publicKeyBytes;
        }
        catch (DocumentValidationException exception) {
            throw exception;
        }
        catch (Exception exception) {
            throw new DocumentValidationException("Document signing public key is invalid.", exception);
        }
    }
}

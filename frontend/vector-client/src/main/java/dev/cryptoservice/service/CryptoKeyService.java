package dev.cryptoservice.service;

import dev.cryptoservice.model.dto.request.RegisterIdentityKeyRequestDto;
import dev.cryptoservice.model.dto.request.UploadOneTimePreKeysRequestDto;
import dev.cryptoservice.model.dto.request.UploadSignedPreKeyRequestDto;
import dev.cryptoservice.model.dto.response.IdentityKeyResponseDto;
import dev.cryptoservice.model.dto.response.PreKeyBundleResponseDto;
import dev.cryptoservice.model.dto.response.PreKeyStatusResponseDto;
import java.util.UUID;

public interface CryptoKeyService {
    IdentityKeyResponseDto registerIdentityKey(
        UUID accountId,
        UUID deviceId,
        RegisterIdentityKeyRequestDto registerIdentityKeyRequestDto
    );

    void uploadSignedPreKey(
        UUID accountId,
        UUID deviceId,
        UploadSignedPreKeyRequestDto uploadSignedPreKeyRequestDto
    );

    void uploadOneTimePreKeys(
        UUID accountId,
        UUID deviceId,
        UploadOneTimePreKeysRequestDto uploadOneTimePreKeysRequestDto
    );

    PreKeyBundleResponseDto getPreKeyBundle(UUID targetDeviceId);

    PreKeyStatusResponseDto getPreKeyStatus(UUID accountId, UUID deviceId);
}

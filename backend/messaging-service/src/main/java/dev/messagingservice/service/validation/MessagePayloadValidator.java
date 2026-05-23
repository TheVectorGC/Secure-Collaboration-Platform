package dev.messagingservice.service.validation;

import dev.messagingservice.exception.MessagePayloadValidationException;
import dev.messagingservice.model.dto.internal.ActiveDeviceDirectoryEntryDto;
import dev.messagingservice.model.dto.request.AccountKeyEnvelopeRequestDto;
import dev.messagingservice.model.dto.request.DeviceMessagePayloadRequestDto;
import dev.messagingservice.model.dto.request.SendMessageRequestDto;
import dev.messagingservice.model.entity.ChatParticipantEntity;
import dev.messagingservice.model.entity.GroupEpochKeyEnvelopeEntity;
import dev.messagingservice.model.enumeration.MessageEncryptionType;
import dev.messagingservice.repository.GroupEpochKeyEnvelopeRepository;
import dev.messagingservice.service.IdentityDeviceDirectoryClient;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@RequiredArgsConstructor
public class MessagePayloadValidator {
    private static final String CONTENT_ALGORITHM = "AES-256-GCM";
    private static final String ACCOUNT_KEY_ENVELOPE_ALGORITHM = "RSA-OAEP-SHA256";

    private final IdentityDeviceDirectoryClient identityDeviceDirectoryClient;
    private final GroupEpochKeyEnvelopeRepository groupEpochKeyEnvelopeRepository;

    public void validate(
            UUID currentAccountId,
            SendMessageRequestDto requestDto,
            List<ChatParticipantEntity> activeParticipants
    ) {
        Map<UUID, Set<UUID>> activeDeviceIdsByAccountId = loadActiveDeviceIdsByAccountId(activeParticipants);
        Set<UUID> currentAccountActiveDeviceIds = activeDeviceIdsByAccountId.getOrDefault(currentAccountId, Set.of());

        if (!currentAccountActiveDeviceIds.contains(requestDto.senderDeviceId())) {
            throw new MessagePayloadValidationException("Sender device is not an active device of the current account.");
        }

        if (requestDto.encryptionType() == MessageEncryptionType.NONE) {
            throw new MessagePayloadValidationException("System messages can't be sent through the public message API.");
        }

        validateEncryptedBody(requestDto);

        if (requestDto.encryptionType() == MessageEncryptionType.CONTENT) {
            validateDevicePayloads(requestDto.devicePayloads() == null ? List.of() : requestDto.devicePayloads(), activeDeviceIdsByAccountId);
            validateAccountKeyEnvelopes(requestDto.accountKeyEnvelopes(), activeDeviceIdsByAccountId.keySet());

            if (requestDto.groupKeyEpoch() != null) {
                throw new MessagePayloadValidationException("Direct content messages can't contain group key epoch.");
            }

            return;
        }

        if (requestDto.encryptionType() == MessageEncryptionType.GROUP) {
            validateGroupPayload(requestDto, activeParticipants);
        }
    }

    private void validateEncryptedBody(SendMessageRequestDto requestDto) {
        if (!StringUtils.hasText(requestDto.encryptedPayload())) {
            throw new MessagePayloadValidationException("Encrypted message body is required.");
        }

        if (!CONTENT_ALGORITHM.equals(requestDto.contentAlgorithm())) {
            throw new MessagePayloadValidationException("Content encryption algorithm must be AES-256-GCM.");
        }

        if (!StringUtils.hasText(requestDto.contentInitializationVectorBase64())
                || !StringUtils.hasText(requestDto.contentAuthenticationTagBase64())) {
            throw new MessagePayloadValidationException("Content encryption metadata is required.");
        }
    }

    private void validateGroupPayload(SendMessageRequestDto requestDto, List<ChatParticipantEntity> activeParticipants) {
        if (requestDto.groupKeyEpoch() == null) {
            throw new MessagePayloadValidationException("Group key epoch is required for GROUP encryption.");
        }

        if (requestDto.accountKeyEnvelopes() != null && !requestDto.accountKeyEnvelopes().isEmpty()) {
            throw new MessagePayloadValidationException("Group messages can't contain per-message account key envelopes. Share group epoch envelopes separately.");
        }

        validateExistingGroupEpochEnvelopeCoverage(activeParticipants, requestDto.groupKeyEpoch());
    }

    private void validateExistingGroupEpochEnvelopeCoverage(List<ChatParticipantEntity> activeParticipants, Integer groupKeyEpoch) {
        if (activeParticipants.isEmpty()) {
            throw new MessagePayloadValidationException("Group message requires active participants.");
        }

        UUID chatId = activeParticipants.get(0).getChatId();
        Set<UUID> activeAccountIds = activeParticipants.stream()
                .map(ChatParticipantEntity::getAccountId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<UUID> accountIdsWithEnvelope = groupEpochKeyEnvelopeRepository
                .findByChatIdAndEpochAndTargetAccountIdIn(chatId, groupKeyEpoch, activeAccountIds)
                .stream()
                .map(GroupEpochKeyEnvelopeEntity::getTargetAccountId)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (!accountIdsWithEnvelope.equals(activeAccountIds)) {
            Set<UUID> missingAccountIds = activeAccountIds.stream()
                    .filter(accountId -> !accountIdsWithEnvelope.contains(accountId))
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            throw new MessagePayloadValidationException("Group epoch key envelopes are missing for active participants: " + missingAccountIds + ".");
        }
    }

    private Map<UUID, Set<UUID>> loadActiveDeviceIdsByAccountId(List<ChatParticipantEntity> activeParticipants) {
        return activeParticipants.stream()
                .map(ChatParticipantEntity::getAccountId)
                .distinct()
                .collect(Collectors.toMap(accountId -> accountId, this::loadActiveDeviceIds));
    }

    private Set<UUID> loadActiveDeviceIds(UUID accountId) {
        List<ActiveDeviceDirectoryEntryDto> activeDeviceDirectoryEntries = identityDeviceDirectoryClient.getActiveAccountDevices(accountId);
        Set<UUID> activeDeviceIds = activeDeviceDirectoryEntries.stream()
                .filter(activeDeviceDirectoryEntry -> activeDeviceDirectoryEntry.accountId() == null
                        || activeDeviceDirectoryEntry.accountId().equals(accountId))
                .map(ActiveDeviceDirectoryEntryDto::deviceId)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (activeDeviceIds.isEmpty()) {
            throw new MessagePayloadValidationException("Active chat participant has no active devices.");
        }

        return activeDeviceIds;
    }

    private void validateDevicePayloads(
            List<DeviceMessagePayloadRequestDto> devicePayloads,
            Map<UUID, Set<UUID>> activeDeviceIdsByAccountId
    ) {
        Set<DeviceAddress> expectedDeviceAddresses = activeDeviceIdsByAccountId.entrySet().stream()
                .flatMap(entry -> entry.getValue().stream().map(deviceId -> new DeviceAddress(entry.getKey(), deviceId)))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<DeviceAddress> actualDeviceAddresses = new LinkedHashSet<>();

        for (DeviceMessagePayloadRequestDto devicePayload : devicePayloads) {
            Set<UUID> activeDeviceIds = activeDeviceIdsByAccountId.get(devicePayload.targetAccountId());

            if (activeDeviceIds == null) {
                throw new MessagePayloadValidationException("Device payload target account is not an active chat participant.");
            }

            if (!activeDeviceIds.contains(devicePayload.targetDeviceId())) {
                throw new MessagePayloadValidationException("Device payload target device is not an active device of the target account.");
            }

            DeviceAddress deviceAddress = new DeviceAddress(devicePayload.targetAccountId(), devicePayload.targetDeviceId());

            if (!actualDeviceAddresses.add(deviceAddress)) {
                throw new MessagePayloadValidationException("Duplicate device payload for target device '" + devicePayload.targetDeviceId() + "'.");
            }
        }

        if (!actualDeviceAddresses.equals(expectedDeviceAddresses)) {
            Set<DeviceAddress> missingDeviceAddresses = expectedDeviceAddresses.stream()
                    .filter(expectedDeviceAddress -> !actualDeviceAddresses.contains(expectedDeviceAddress))
                    .collect(Collectors.toCollection(LinkedHashSet::new));

            if (!missingDeviceAddresses.isEmpty()) {
                throw new MessagePayloadValidationException("Device payloads do not cover all active chat participant devices.");
            }

            throw new MessagePayloadValidationException("Device payloads contain unexpected devices.");
        }
    }

    private void validateAccountKeyEnvelopes(
            List<AccountKeyEnvelopeRequestDto> accountKeyEnvelopes,
            Set<UUID> activeAccountIds
    ) {
        if (accountKeyEnvelopes == null || accountKeyEnvelopes.isEmpty()) {
            throw new MessagePayloadValidationException("Account key envelopes can't be empty for encrypted messages.");
        }

        Set<UUID> actualAccountIds = new LinkedHashSet<>();

        for (AccountKeyEnvelopeRequestDto accountKeyEnvelope : accountKeyEnvelopes) {
            if (!activeAccountIds.contains(accountKeyEnvelope.targetAccountId())) {
                throw new MessagePayloadValidationException("Account key envelope target is not an active chat participant.");
            }

            if (!actualAccountIds.add(accountKeyEnvelope.targetAccountId())) {
                throw new MessagePayloadValidationException("Duplicate account key envelope for account '" + accountKeyEnvelope.targetAccountId() + "'.");
            }

            if (!ACCOUNT_KEY_ENVELOPE_ALGORITHM.equals(accountKeyEnvelope.algorithm())) {
                throw new MessagePayloadValidationException("Account key envelope algorithm must be RSA-OAEP-SHA256.");
            }

            if (!StringUtils.hasText(accountKeyEnvelope.encryptedKeyBase64())) {
                throw new MessagePayloadValidationException("Account key envelope encrypted key is required.");
            }
        }

        if (!actualAccountIds.equals(activeAccountIds)) {
            throw new MessagePayloadValidationException("Account key envelopes do not cover all active chat participants.");
        }
    }

    private record DeviceAddress(UUID accountId, UUID deviceId) {}
}

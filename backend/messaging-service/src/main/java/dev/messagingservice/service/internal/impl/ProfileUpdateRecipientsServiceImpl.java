package dev.messagingservice.service.internal.impl;

import dev.messagingservice.repository.ChatParticipantRepository;
import dev.messagingservice.service.internal.ProfileUpdateRecipientsService;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProfileUpdateRecipientsServiceImpl implements ProfileUpdateRecipientsService {
    private final ChatParticipantRepository chatParticipantRepository;

    @Override
    @Transactional(readOnly = true)
    public List<UUID> getRecipientAccountIds(UUID accountId) {
        if (accountId == null) {
            return List.of();
        }

        LinkedHashSet<UUID> recipientAccountIds = new LinkedHashSet<>();
        recipientAccountIds.add(accountId);
        chatParticipantRepository.findActiveProfileUpdateRecipientAccountIds(accountId).stream()
                .filter(Objects::nonNull)
                .forEach(recipientAccountIds::add);

        return recipientAccountIds.stream().toList();
    }
}

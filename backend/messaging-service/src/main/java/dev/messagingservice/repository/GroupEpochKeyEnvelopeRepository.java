package dev.messagingservice.repository;

import dev.messagingservice.model.entity.GroupEpochKeyEnvelopeEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GroupEpochKeyEnvelopeRepository extends JpaRepository<GroupEpochKeyEnvelopeEntity, UUID> {
    Optional<GroupEpochKeyEnvelopeEntity> findByChatIdAndEpochAndTargetAccountId(UUID chatId, Integer epoch, UUID targetAccountId);

    List<GroupEpochKeyEnvelopeEntity> findByChatIdAndEpochInAndTargetAccountId(UUID chatId, Collection<Integer> epochs, UUID targetAccountId);

    List<GroupEpochKeyEnvelopeEntity> findByChatIdAndEpochAndTargetAccountIdIn(UUID chatId, Integer epoch, Set<UUID> targetAccountIds);
}

package dev.messagingservice.service.mapper;

import dev.messagingservice.model.dto.response.AccountKeyEnvelopeResponseDto;
import dev.messagingservice.model.dto.response.MessageDeliveryStateResponseDto;
import dev.messagingservice.model.dto.response.MessageDevicePayloadResponseDto;
import dev.messagingservice.model.dto.response.MessageResponseDto;
import dev.messagingservice.model.entity.GroupEpochKeyEnvelopeEntity;
import dev.messagingservice.model.entity.MessageAccountKeyEnvelopeEntity;
import dev.messagingservice.model.entity.MessageDeliveryStateEntity;
import dev.messagingservice.model.entity.MessageDevicePayloadEntity;
import dev.messagingservice.model.entity.MessageEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class MessageMapper {
    public MessageResponseDto toMessageResponse(
            MessageEntity messageEntity,
            List<MessageDevicePayloadEntity> payloadEntities,
            List<MessageAccountKeyEnvelopeEntity> accountKeyEnvelopeEntities,
            GroupEpochKeyEnvelopeEntity groupEpochKeyEnvelopeEntity,
            List<MessageDeliveryStateEntity> deliveryStateEntities,
            UUID currentAccountId
    ) {
        List<MessageDeliveryStateResponseDto> deliveryStateResponses = deliveryStateEntities.stream()
                .map(this::toDeliveryStateResponse)
                .toList();
        List<MessageDevicePayloadResponseDto> payloadResponses = payloadEntities.stream()
                .filter(payloadEntity -> payloadEntity.getTargetAccountId().equals(currentAccountId))
                .map(this::toPayloadResponse)
                .toList();
        List<AccountKeyEnvelopeResponseDto> accountKeyEnvelopeResponses = accountKeyEnvelopeEntities.stream()
                .filter(envelopeEntity -> envelopeEntity.getTargetAccountId().equals(currentAccountId))
                .map(this::toAccountKeyEnvelopeResponse)
                .toList();

        return new MessageResponseDto(
                messageEntity.getId(),
                messageEntity.getChatId(),
                messageEntity.getSenderAccountId(),
                messageEntity.getSenderDeviceId(),
                messageEntity.getClientMessageId(),
                messageEntity.getMessageType(),
                messageEntity.getEncryptionType(),
                messageEntity.getEncryptedPayload(),
                messageEntity.getContentAlgorithm(),
                messageEntity.getContentInitializationVectorBase64(),
                messageEntity.getContentAuthenticationTagBase64(),
                messageEntity.getGroupKeyEpoch(),
                payloadResponses,
                accountKeyEnvelopeResponses,
                groupEpochKeyEnvelopeEntity == null ? null : toGroupEpochKeyEnvelopeResponse(groupEpochKeyEnvelopeEntity),
                messageEntity.getCreatedAt(),
                deliveryStateResponses
        );
    }

    public MessageDevicePayloadResponseDto toPayloadResponse(MessageDevicePayloadEntity payloadEntity) {
        return new MessageDevicePayloadResponseDto(
                payloadEntity.getTargetAccountId(),
                payloadEntity.getTargetDeviceId(),
                payloadEntity.getCiphertextType(),
                payloadEntity.getEncryptedPayload()
        );
    }

    public AccountKeyEnvelopeResponseDto toAccountKeyEnvelopeResponse(MessageAccountKeyEnvelopeEntity envelopeEntity) {
        return new AccountKeyEnvelopeResponseDto(
                envelopeEntity.getTargetAccountId(),
                null,
                envelopeEntity.getAlgorithm(),
                envelopeEntity.getEncryptedKeyBase64()
        );
    }

    public AccountKeyEnvelopeResponseDto toGroupEpochKeyEnvelopeResponse(GroupEpochKeyEnvelopeEntity envelopeEntity) {
        return new AccountKeyEnvelopeResponseDto(
                envelopeEntity.getTargetAccountId(),
                envelopeEntity.getSenderDeviceId(),
                envelopeEntity.getAlgorithm(),
                envelopeEntity.getEncryptedKeyBase64()
        );
    }

    private MessageDeliveryStateResponseDto toDeliveryStateResponse(MessageDeliveryStateEntity deliveryStateEntity) {
        return new MessageDeliveryStateResponseDto(
                deliveryStateEntity.getAccountId(),
                deliveryStateEntity.getStatus(),
                deliveryStateEntity.getDeliveredAt(),
                deliveryStateEntity.getReadAt()
        );
    }
}

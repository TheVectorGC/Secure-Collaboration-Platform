package dev.messagingservice.service;

import dev.messagingservice.model.dto.request.AddGroupParticipantRequestDto;
import dev.messagingservice.model.dto.request.CreateDirectChatRequestDto;
import dev.messagingservice.model.dto.request.CreateGroupChatRequestDto;
import dev.messagingservice.model.dto.request.UpdateGroupAvatarRequestDto;
import dev.messagingservice.model.dto.request.UpsertGroupEpochKeyEnvelopeRequestDto;
import dev.messagingservice.model.dto.response.AccountKeyEnvelopeResponseDto;
import dev.messagingservice.model.dto.response.ChatResponseDto;
import java.util.List;
import java.util.UUID;

public interface ChatService {
    ChatResponseDto createOrGetDirectChat(UUID currentAccountId, CreateDirectChatRequestDto createDirectChatRequestDto);

    ChatResponseDto createOrGetSelfChat(UUID currentAccountId);

    ChatResponseDto createGroupChat(UUID currentAccountId, CreateGroupChatRequestDto createGroupChatRequestDto);

    ChatResponseDto addGroupParticipant(UUID currentAccountId, UUID chatId, AddGroupParticipantRequestDto requestDto);

    ChatResponseDto removeGroupParticipant(UUID currentAccountId, UUID chatId, UUID participantAccountId);

    ChatResponseDto leaveGroup(UUID currentAccountId, UUID chatId);

    ChatResponseDto rejoinGroup(UUID currentAccountId, UUID chatId);

    ChatResponseDto updateGroupAvatar(UUID currentAccountId, UUID chatId, UpdateGroupAvatarRequestDto updateGroupAvatarRequestDto);

    void upsertGroupEpochKeyEnvelope(UUID currentAccountId, UUID chatId, UpsertGroupEpochKeyEnvelopeRequestDto requestDto);

    AccountKeyEnvelopeResponseDto getCurrentAccountGroupEpochKeyEnvelope(UUID currentAccountId, UUID chatId, Integer epoch);

    List<ChatResponseDto> getCurrentAccountChats(UUID currentAccountId);

    ChatResponseDto getChat(UUID currentAccountId, UUID chatId);
}

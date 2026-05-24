package dev.messagingservice.controller;

import dev.messagingservice.model.dto.error.ApiErrorResponseDto;
import dev.messagingservice.model.dto.request.AddGroupParticipantRequestDto;
import dev.messagingservice.model.dto.request.CreateDirectChatRequestDto;
import dev.messagingservice.model.dto.request.CreateGroupChatRequestDto;
import dev.messagingservice.model.dto.request.UpdateGroupAvatarRequestDto;
import dev.messagingservice.model.dto.request.UpsertGroupEpochKeyEnvelopeRequestDto;
import dev.messagingservice.model.dto.response.AccountKeyEnvelopeResponseDto;
import dev.messagingservice.model.dto.response.ChatResponseDto;
import dev.messagingservice.service.ChatService;
import dev.messagingservice.service.CurrentAccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/chats")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Chats", description = "Direct, self and group chat management endpoints.")
public class ChatController {
    private final ChatService chatService;
    private final CurrentAccountService currentAccountService;

    @Operation(
            summary = "Create or resolve a direct chat",
            description = "Returns an existing direct chat for the current account and recipient, or creates a new chat when no direct chat exists. Blocked account pairs can open the chat, but cannot send messages until unblocked.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Direct chat resolved."),
                    @ApiResponse(responseCode = "400", description = "Request validation failed.", content = @Content(schema = @Schema(implementation = ApiErrorResponseDto.class))),
                    @ApiResponse(responseCode = "403", description = "Direct chat access is denied.", content = @Content(schema = @Schema(implementation = ApiErrorResponseDto.class)))
            }
    )
    @PostMapping("/direct")
    public ResponseEntity<ChatResponseDto> createOrGetDirectChat(@Valid @RequestBody CreateDirectChatRequestDto requestDto) {
        return ResponseEntity.ok(chatService.createOrGetDirectChat(currentAccountService.getCurrentAccountId(), requestDto));
    }

    @Operation(summary = "Create or resolve the current account self chat", description = "Returns the private self chat used for saved messages.")
    @PostMapping("/self")
    public ResponseEntity<ChatResponseDto> createOrGetSelfChat() {
        return ResponseEntity.ok(chatService.createOrGetSelfChat(currentAccountService.getCurrentAccountId()));
    }

    @Operation(summary = "Create a group chat", description = "Creates a group chat with the current account as owner and initializes the first group key epoch.")
    @PostMapping("/groups")
    public ResponseEntity<ChatResponseDto> createGroupChat(@Valid @RequestBody CreateGroupChatRequestDto requestDto) {
        return new ResponseEntity<>(chatService.createGroupChat(currentAccountService.getCurrentAccountId(), requestDto), HttpStatus.CREATED);
    }

    @Operation(summary = "Add a group participant", description = "Adds or reactivates a participant and rotates the group key epoch.")
    @PostMapping("/{chatId}/participants")
    public ResponseEntity<ChatResponseDto> addGroupParticipant(
            @PathVariable UUID chatId,
            @Valid @RequestBody AddGroupParticipantRequestDto requestDto
    ) {
        return ResponseEntity.ok(chatService.addGroupParticipant(currentAccountService.getCurrentAccountId(), chatId, requestDto));
    }

    @Operation(summary = "Remove a group participant", description = "Removes an active participant and rotates the group key epoch.")
    @DeleteMapping("/{chatId}/participants/{participantAccountId}")
    public ResponseEntity<ChatResponseDto> removeGroupParticipant(
            @PathVariable UUID chatId,
            @PathVariable UUID participantAccountId
    ) {
        return ResponseEntity.ok(chatService.removeGroupParticipant(currentAccountService.getCurrentAccountId(), chatId, participantAccountId));
    }

    @Operation(summary = "Update group avatar", description = "Updates or clears the group avatar data URL.")
    @PutMapping("/{chatId}/avatar")
    public ResponseEntity<ChatResponseDto> updateGroupAvatar(
            @PathVariable UUID chatId,
            @Valid @RequestBody UpdateGroupAvatarRequestDto requestDto
    ) {
        return ResponseEntity.ok(chatService.updateGroupAvatar(currentAccountService.getCurrentAccountId(), chatId, requestDto));
    }

    @Operation(summary = "Store a group epoch key envelope", description = "Stores an encrypted group epoch key envelope for one active participant account.")
    @PutMapping("/{chatId}/group-key-envelopes")
    public ResponseEntity<Void> upsertGroupEpochKeyEnvelope(
            @PathVariable UUID chatId,
            @Valid @RequestBody UpsertGroupEpochKeyEnvelopeRequestDto requestDto
    ) {
        chatService.upsertGroupEpochKeyEnvelope(currentAccountService.getCurrentAccountId(), chatId, requestDto);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Get current account group epoch key envelope", description = "Returns the encrypted group epoch key envelope for the authenticated account.")
    @GetMapping("/{chatId}/group-key-envelopes/{epoch}/me")
    public ResponseEntity<AccountKeyEnvelopeResponseDto> getCurrentAccountGroupEpochKeyEnvelope(
            @PathVariable UUID chatId,
            @PathVariable Integer epoch
    ) {
        return ResponseEntity.ok(chatService.getCurrentAccountGroupEpochKeyEnvelope(currentAccountService.getCurrentAccountId(), chatId, epoch));
    }

    @Operation(summary = "List current account chats", description = "Returns all chats visible to the current account ordered by latest activity.")
    @GetMapping
    public ResponseEntity<List<ChatResponseDto>> getCurrentAccountChats() {
        return ResponseEntity.ok(chatService.getCurrentAccountChats(currentAccountService.getCurrentAccountId()));
    }

    @Operation(summary = "Get chat by ID", description = "Returns one chat if the current account has access to it.")
    @GetMapping("/{chatId}")
    public ResponseEntity<ChatResponseDto> getChat(@PathVariable UUID chatId) {
        return ResponseEntity.ok(chatService.getChat(currentAccountService.getCurrentAccountId(), chatId));
    }
}

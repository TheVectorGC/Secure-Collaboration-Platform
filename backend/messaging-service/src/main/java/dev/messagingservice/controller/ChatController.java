package dev.messagingservice.controller;

import dev.messagingservice.model.dto.request.CreateDirectChatRequestDto;
import dev.messagingservice.model.dto.response.ChatResponseDto;
import dev.messagingservice.service.ChatService;
import dev.messagingservice.service.CurrentAccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/chats")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Chats", description = "APIs for direct and self chats")
public class ChatController {
    private final ChatService chatService;
    private final CurrentAccountService currentAccountService;

    @Operation(summary = "Create or get direct chat")
    @PostMapping("/direct")
    public ResponseEntity<ChatResponseDto> createOrGetDirectChat(
        @Valid @RequestBody CreateDirectChatRequestDto createDirectChatRequestDto
    ) {
        return new ResponseEntity<>(
            chatService.createOrGetDirectChat(currentAccountService.getCurrentAccountId(), createDirectChatRequestDto),
            HttpStatus.OK
        );
    }

    @Operation(summary = "Create or get self chat")
    @PostMapping("/self")
    public ResponseEntity<ChatResponseDto> createOrGetSelfChat() {
        return new ResponseEntity<>(chatService.createOrGetSelfChat(currentAccountService.getCurrentAccountId()), HttpStatus.OK);
    }

    @Operation(summary = "Get current account chats")
    @GetMapping
    public ResponseEntity<List<ChatResponseDto>> getCurrentAccountChats() {
        return ResponseEntity.ok(chatService.getCurrentAccountChats(currentAccountService.getCurrentAccountId()));
    }

    @Operation(summary = "Get chat by ID")
    @GetMapping("/{chatId}")
    public ResponseEntity<ChatResponseDto> getChat(@PathVariable UUID chatId) {
        return ResponseEntity.ok(chatService.getChat(currentAccountService.getCurrentAccountId(), chatId));
    }
}

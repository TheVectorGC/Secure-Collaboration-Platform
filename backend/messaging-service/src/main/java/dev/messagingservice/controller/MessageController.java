package dev.messagingservice.controller;

import dev.messagingservice.model.dto.request.MarkChatReadRequestDto;
import dev.messagingservice.model.dto.request.SendMessageRequestDto;
import dev.messagingservice.model.dto.response.MessageResponseDto;
import dev.messagingservice.service.CurrentAccountService;
import dev.messagingservice.service.MessageService;
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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/chats/{chatId}/messages")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Messages", description = "APIs for encrypted messages")
public class MessageController {
    private final MessageService messageService;
    private final CurrentAccountService currentAccountService;

    @Operation(summary = "Send encrypted message")
    @PostMapping
    public ResponseEntity<MessageResponseDto> sendMessage(
        @PathVariable UUID chatId,
        @Valid @RequestBody SendMessageRequestDto sendMessageRequestDto
    ) {
        return new ResponseEntity<>(
            messageService.sendMessage(currentAccountService.getCurrentAccountId(), chatId, sendMessageRequestDto),
            HttpStatus.CREATED
        );
    }

    @Operation(summary = "Get chat messages")
    @GetMapping
    public ResponseEntity<List<MessageResponseDto>> getChatMessages(@PathVariable UUID chatId) {
        return ResponseEntity.ok(messageService.getChatMessages(currentAccountService.getCurrentAccountId(), chatId));
    }

    @Operation(summary = "Mark message delivered")
    @PatchMapping("/{messageId}/delivered")
    public ResponseEntity<Void> markMessageDelivered(
        @PathVariable UUID chatId,
        @PathVariable UUID messageId
    ) {
        messageService.markMessageDelivered(currentAccountService.getCurrentAccountId(), chatId, messageId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @Operation(summary = "Mark chat read up to message")
    @PatchMapping("/read")
    public ResponseEntity<Void> markChatRead(
        @PathVariable UUID chatId,
        @Valid @RequestBody MarkChatReadRequestDto markChatReadRequestDto
    ) {
        messageService.markChatRead(currentAccountService.getCurrentAccountId(), chatId, markChatReadRequestDto);
        return new ResponseEntity<>(HttpStatus.OK);
    }
}

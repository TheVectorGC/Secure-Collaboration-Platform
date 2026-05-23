package dev.messagingservice.controller;

import dev.messagingservice.model.dto.error.ApiErrorResponseDto;
import dev.messagingservice.model.dto.request.MarkChatReadRequestDto;
import dev.messagingservice.model.dto.request.SendMessageRequestDto;
import dev.messagingservice.model.dto.response.MessageResponseDto;
import dev.messagingservice.service.CurrentAccountService;
import dev.messagingservice.service.MessageService;
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
@Tag(name = "Messages", description = "Encrypted message and delivery state endpoints.")
public class MessageController {
    private final MessageService messageService;
    private final CurrentAccountService currentAccountService;

    @Operation(
            summary = "Send an encrypted message",
            description = "Stores an end-to-end encrypted message and validates that encrypted key payloads cover all active recipient devices or all active participant accounts.",
            responses = {
                    @ApiResponse(responseCode = "201", description = "Message created."),
                    @ApiResponse(responseCode = "400", description = "Encrypted payload is invalid.", content = @Content(schema = @Schema(implementation = ApiErrorResponseDto.class))),
                    @ApiResponse(responseCode = "403", description = "Current account cannot send to this chat.", content = @Content(schema = @Schema(implementation = ApiErrorResponseDto.class)))
            }
    )
    @PostMapping
    public ResponseEntity<MessageResponseDto> sendMessage(
            @PathVariable UUID chatId,
            @Valid @RequestBody SendMessageRequestDto requestDto
    ) {
        return new ResponseEntity<>(messageService.sendMessage(currentAccountService.getCurrentAccountId(), chatId, requestDto), HttpStatus.CREATED);
    }

    @Operation(summary = "List chat messages", description = "Returns messages visible to the current account according to direct, self or group history visibility rules.")
    @GetMapping
    public ResponseEntity<List<MessageResponseDto>> getChatMessages(@PathVariable UUID chatId) {
        return ResponseEntity.ok(messageService.getChatMessages(currentAccountService.getCurrentAccountId(), chatId));
    }

    @Operation(summary = "Mark message delivered", description = "Marks one message as delivered for the current account.")
    @PatchMapping("/{messageId}/delivered")
    public ResponseEntity<Void> markMessageDelivered(
            @PathVariable UUID chatId,
            @PathVariable UUID messageId
    ) {
        messageService.markMessageDelivered(currentAccountService.getCurrentAccountId(), chatId, messageId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Mark chat read", description = "Marks all visible messages up to the supplied message as read for the current account.")
    @PatchMapping("/read")
    public ResponseEntity<Void> markChatRead(
            @PathVariable UUID chatId,
            @Valid @RequestBody MarkChatReadRequestDto requestDto
    ) {
        messageService.markChatRead(currentAccountService.getCurrentAccountId(), chatId, requestDto);
        return ResponseEntity.ok().build();
    }
}

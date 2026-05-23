package dev.identityservice.controller;

import dev.identityservice.model.dto.request.BlockAccountRequestDto;
import dev.identityservice.model.dto.response.AccountBlockResponseDto;
import dev.identityservice.model.dto.response.AccountBlockStatusResponseDto;
import dev.identityservice.service.AccountBlockService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/account-blocks")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Account Blocks", description = "APIs for account-level user blocking used by messaging services.")
public class AccountBlockController {
    private final AccountBlockService accountBlockService;

    @Operation(
            summary = "Block an account",
            description = "Creates an account-level block owned by the authenticated account and publishes an identity event for downstream services.",
            responses = {
                    @ApiResponse(responseCode = "201", description = "Account was blocked."),
                    @ApiResponse(responseCode = "400", description = "Request validation failed."),
                    @ApiResponse(responseCode = "401", description = "Authentication is required."),
                    @ApiResponse(responseCode = "404", description = "Target account was not found.")
            }
    )
    @PostMapping
    public ResponseEntity<AccountBlockResponseDto> blockAccount(
            Principal principal,
            @Valid @RequestBody BlockAccountRequestDto requestDto
    ) {
        AccountBlockResponseDto responseDto = accountBlockService.blockAccount(principal.getName(), requestDto.blockedAccountId());
        return new ResponseEntity<>(responseDto, HttpStatus.CREATED);
    }

    @Operation(summary = "Remove account block", description = "Removes an existing block created by the authenticated account.")
    @DeleteMapping("/{blockedAccountId}")
    public ResponseEntity<Void> unblockAccount(
            Principal principal,
            @PathVariable UUID blockedAccountId
    ) {
        accountBlockService.unblockAccount(principal.getName(), blockedAccountId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "List current account blocks", description = "Returns all account blocks owned by the authenticated account.")
    @GetMapping
    public ResponseEntity<List<AccountBlockResponseDto>> getCurrentAccountBlocks(Principal principal) {
        return ResponseEntity.ok(accountBlockService.getCurrentAccountBlocks(principal.getName()));
    }

    @Operation(
            summary = "Check block status",
            description = "Checks whether the authenticated account blocks the requested account.",
            responses = @ApiResponse(
                    responseCode = "200",
                    description = "Block status returned.",
                    content = @Content(
                            schema = @Schema(implementation = AccountBlockStatusResponseDto.class),
                            examples = @ExampleObject(value = "{\"blockerAccountId\":\"11111111-1111-1111-1111-111111111111\",\"blockedAccountId\":\"22222222-2222-2222-2222-222222222222\",\"blocked\":true}")
                    )
            )
    )
    @GetMapping("/{blockedAccountId}/status")
    public ResponseEntity<AccountBlockStatusResponseDto> getCurrentAccountBlockStatus(
            Principal principal,
            @PathVariable UUID blockedAccountId
    ) {
        return ResponseEntity.ok(accountBlockService.getCurrentAccountBlockStatus(principal.getName(), blockedAccountId));
    }
}

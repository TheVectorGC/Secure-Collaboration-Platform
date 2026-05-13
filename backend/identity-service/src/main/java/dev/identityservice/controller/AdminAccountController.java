package dev.identityservice.controller;

import dev.identityservice.model.dto.request.CreateAccountRegistrationRequestDto;
import dev.identityservice.model.dto.response.AccountRegistrationResponseDto;
import dev.identityservice.service.AdminAccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/accounts")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin Account Management", description = "APIs for controlled registration and account lifecycle")
public class AdminAccountController {
    private final AdminAccountService adminAccountService;

    @Operation(summary = "Create account invite")
    @PostMapping("/registrations")
    public ResponseEntity<AccountRegistrationResponseDto> createAccountRegistration(
            @Valid @RequestBody CreateAccountRegistrationRequestDto createAccountRegistrationRequestDto
    ) {
        AccountRegistrationResponseDto accountRegistrationResponseDto = adminAccountService.createAccountRegistration(createAccountRegistrationRequestDto);
        return new ResponseEntity<>(accountRegistrationResponseDto, HttpStatus.CREATED);
    }

    @Operation(summary = "Block account")
    @PatchMapping("/{accountId}/block")
    public ResponseEntity<Void> blockAccount(@PathVariable UUID accountId) {
        adminAccountService.blockAccount(accountId);
        return new ResponseEntity<>(HttpStatus.OK);
    }
}

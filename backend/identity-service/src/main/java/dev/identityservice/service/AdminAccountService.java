package dev.identityservice.service;

import dev.identityservice.model.dto.request.CreateAccountRegistrationRequestDto;
import dev.identityservice.model.dto.response.AccountRegistrationResponseDto;
import java.util.UUID;

public interface AdminAccountService {
    AccountRegistrationResponseDto createAccountRegistration(CreateAccountRegistrationRequestDto createAccountRegistrationRequestDto);
    void blockAccount(UUID accountId);
}

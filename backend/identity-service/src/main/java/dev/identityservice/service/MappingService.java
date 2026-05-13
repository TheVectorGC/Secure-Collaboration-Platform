package dev.identityservice.service;

import dev.identityservice.model.dto.response.AccountProfileResponseDto;
import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.model.entity.ProfileEntity;

public interface MappingService {
    AccountProfileResponseDto mapToAccountProfileResponseDto(
            AccountEntity accountEntity,
            ProfileEntity profileEntity
    );
}
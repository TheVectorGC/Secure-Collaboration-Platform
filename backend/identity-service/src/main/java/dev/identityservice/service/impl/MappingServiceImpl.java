package dev.identityservice.service.impl;

import dev.identityservice.model.dto.response.AccountProfileResponseDto;
import dev.identityservice.model.entity.AccountEntity;
import dev.identityservice.model.entity.ProfileEntity;
import dev.identityservice.service.MappingService;
import org.springframework.stereotype.Service;

@Service
public class MappingServiceImpl implements MappingService {
    @Override
    public AccountProfileResponseDto mapToAccountProfileResponseDto(
            AccountEntity accountEntity,
            ProfileEntity profileEntity
    ) {
        return new AccountProfileResponseDto(
                accountEntity.getId(),
                accountEntity.getUsername(),
                accountEntity.getEmail(),
                profileEntity.getFirstName(),
                profileEntity.getLastName(),
                profileEntity.getMiddleName(),
                accountEntity.getStatus(),
                profileEntity.getAvatarType(),
                profileEntity.getAvatarFileId(),
                profileEntity.getAvatarDataUrl()
        );
    }
}

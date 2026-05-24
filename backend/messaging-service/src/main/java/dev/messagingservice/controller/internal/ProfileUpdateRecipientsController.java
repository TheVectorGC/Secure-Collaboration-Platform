package dev.messagingservice.controller.internal;

import dev.messagingservice.model.dto.response.internal.ProfileUpdateRecipientsResponseDto;
import dev.messagingservice.properties.InternalApiProperties;
import dev.messagingservice.service.internal.ProfileUpdateRecipientsService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/internal/profile-updates")
public class ProfileUpdateRecipientsController {
    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";

    private final ProfileUpdateRecipientsService profileUpdateRecipientsService;
    private final InternalApiProperties internalApiProperties;

    @GetMapping("/{accountId}/recipients")
    public ResponseEntity<ProfileUpdateRecipientsResponseDto> getProfileUpdateRecipients(
            @PathVariable UUID accountId,
            @RequestHeader(name = INTERNAL_TOKEN_HEADER, required = false) String internalToken
    ) {
        validateInternalToken(internalToken);
        return ResponseEntity.ok(new ProfileUpdateRecipientsResponseDto(
                accountId,
                profileUpdateRecipientsService.getRecipientAccountIds(accountId)
        ));
    }

    private void validateInternalToken(String internalToken) {
        String configuredToken = internalApiProperties.token();

        if (configuredToken == null || configuredToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Internal API token is not configured.");
        }

        if (!configuredToken.equals(internalToken)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid internal API token.");
        }
    }
}

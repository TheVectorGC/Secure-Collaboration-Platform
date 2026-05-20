package dev.identityservice.controller;

import dev.identityservice.model.dto.request.UpdateProfileAvatarRequestDto;
import dev.identityservice.model.dto.response.AccountProfileResponseDto;
import dev.identityservice.service.ProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/profiles")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Profile Directory", description = "APIs for current profile and corporate directory search")
public class ProfileController {
    private final ProfileService profileService;

    @Operation(summary = "Get current profile")
    @GetMapping("/me")
    public ResponseEntity<AccountProfileResponseDto> getCurrentProfile(Principal principal) {
        return ResponseEntity.ok(profileService.getCurrentProfile(principal.getName()));
    }

    @Operation(summary = "Update current profile avatar")
    @PutMapping("/me/avatar")
    public ResponseEntity<AccountProfileResponseDto> updateCurrentProfileAvatar(
            Principal principal,
            @Valid @RequestBody UpdateProfileAvatarRequestDto requestDto
    ) {
        return ResponseEntity.ok(profileService.updateCurrentProfileAvatar(principal.getName(), requestDto));
    }

    @Operation(summary = "Search corporate users")
    @GetMapping("/search")
    public ResponseEntity<List<AccountProfileResponseDto>> searchProfiles(@RequestParam String query) {
        return ResponseEntity.ok(profileService.searchProfiles(query));
    }
}

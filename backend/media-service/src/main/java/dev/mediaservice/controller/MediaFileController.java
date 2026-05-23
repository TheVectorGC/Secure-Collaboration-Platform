package dev.mediaservice.controller;

import dev.mediaservice.model.dto.request.GrantMediaAccessRequestDto;
import dev.mediaservice.model.dto.request.UploadEncryptedMediaRequestDto;
import dev.mediaservice.model.dto.response.MediaFileResponseDto;
import dev.mediaservice.model.dto.response.StoredMediaResourceDto;
import dev.mediaservice.service.MediaFileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Encrypted Media Files", description = "Stores and serves encrypted media objects used by Vector messages and documents.")
@RestController
@RequestMapping("/api/v1/media/files")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class MediaFileController {
    private static final String CONTENT_DIGEST_HEADER = "Digest";
    private static final String CONTENT_DIGEST_ALGORITHM = "SHA-256=";

    private final MediaFileService mediaFileService;

    @Operation(
        summary = "Upload encrypted media file",
        description = "Stores encrypted binary content and records access metadata. The service never receives plaintext media content or decryption keys.",
        responses = {
            @ApiResponse(responseCode = "200", description = "Encrypted media file was stored."),
            @ApiResponse(responseCode = "400", description = "Media metadata or encrypted file is invalid.", content = @Content),
            @ApiResponse(responseCode = "401", description = "Authentication token is missing or invalid.", content = @Content),
            @ApiResponse(responseCode = "403", description = "Current account cannot upload to the requested chat.", content = @Content)
        })
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MediaFileResponseDto> uploadEncryptedFile(
        @Parameter(description = "Encrypted media bytes.", required = true)
        @RequestPart("file") MultipartFile encryptedFile,
        @Parameter(description = "Encrypted media metadata.", required = true, schema = @Schema(implementation = UploadEncryptedMediaRequestDto.class))
        @Valid @RequestPart("metadata") UploadEncryptedMediaRequestDto requestDto
    ) {
        return ResponseEntity.ok(mediaFileService.uploadEncryptedFile(encryptedFile, requestDto));
    }

    @Operation(
        summary = "Get encrypted media metadata",
        description = "Returns encrypted media metadata after validating uploader, explicit access or chat history visibility.",
        responses = {
            @ApiResponse(responseCode = "200", description = "Metadata was returned."),
            @ApiResponse(responseCode = "403", description = "Current account cannot access this media file.", content = @Content),
            @ApiResponse(responseCode = "404", description = "Media file was not found.", content = @Content)
        })
    @GetMapping("/{mediaFileId}")
    public ResponseEntity<MediaFileResponseDto> getMetadata(@PathVariable UUID mediaFileId) {
        return ResponseEntity.ok(mediaFileService.getMetadata(mediaFileId));
    }

    @Operation(
        summary = "Download encrypted media bytes",
        description = "Streams encrypted bytes without exposing plaintext content or media decryption keys.",
        responses = {
            @ApiResponse(responseCode = "200", description = "Encrypted file stream was returned."),
            @ApiResponse(responseCode = "403", description = "Current account cannot access this media file.", content = @Content),
            @ApiResponse(responseCode = "404", description = "Media file was not found.", content = @Content)
        })
    @GetMapping("/{mediaFileId}/download")
    public ResponseEntity<Resource> downloadEncryptedFile(@PathVariable UUID mediaFileId) {
        StoredMediaResourceDto storedMediaResourceDto = mediaFileService.getEncryptedFile(mediaFileId);
        FileSystemResource fileSystemResource = new FileSystemResource(storedMediaResourceDto.path());
        String fileName = URLEncoder.encode(mediaFileId + ".bin", StandardCharsets.UTF_8);
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .contentLength(storedMediaResourceDto.encryptedSizeBytes())
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + fileName)
            .header(CONTENT_DIGEST_HEADER, CONTENT_DIGEST_ALGORITHM + storedMediaResourceDto.encryptedSha256Base64())
            .body(fileSystemResource);
    }

    @Operation(
        summary = "Grant encrypted media access",
        description = "Adds explicit account access records for a media file. Only the uploader can grant access.",
        responses = {
            @ApiResponse(responseCode = "204", description = "Access was granted."),
            @ApiResponse(responseCode = "403", description = "Current account is not the uploader.", content = @Content),
            @ApiResponse(responseCode = "404", description = "Media file was not found.", content = @Content)
        })
    @PatchMapping("/{mediaFileId}/access")
    public ResponseEntity<Void> grantAccess(
        @PathVariable UUID mediaFileId,
        @Valid @RequestBody GrantMediaAccessRequestDto requestDto
    ) {
        mediaFileService.grantAccess(mediaFileId, requestDto);
        return ResponseEntity.noContent().build();
    }

    @Operation(
        summary = "Delete own encrypted media file",
        description = "Marks an uploaded media file as deleted and removes encrypted bytes from local storage.",
        responses = {
            @ApiResponse(responseCode = "204", description = "Media file was deleted."),
            @ApiResponse(responseCode = "403", description = "Current account is not the uploader.", content = @Content),
            @ApiResponse(responseCode = "404", description = "Media file was not found.", content = @Content)
        })
    @DeleteMapping("/{mediaFileId}")
    public ResponseEntity<Void> deleteOwnFile(@PathVariable UUID mediaFileId) {
        mediaFileService.deleteOwnFile(mediaFileId);
        return ResponseEntity.noContent().build();
    }
}

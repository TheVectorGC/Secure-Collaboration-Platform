package dev.mediaservice.controller;

import dev.mediaservice.model.dto.request.GrantMediaAccessRequestDto;
import dev.mediaservice.model.dto.request.UploadEncryptedMediaRequestDto;
import dev.mediaservice.model.dto.response.MediaFileResponseDto;
import dev.mediaservice.model.dto.response.StoredMediaResourceDto;
import dev.mediaservice.service.MediaFileService;
import jakarta.validation.Valid;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/media/files")
@RequiredArgsConstructor
public class MediaFileController {
    private final MediaFileService mediaFileService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MediaFileResponseDto> uploadEncryptedFile(
        @RequestPart("file") MultipartFile encryptedFile,
        @Valid @RequestPart(value = "metadata", required = false) UploadEncryptedMediaRequestDto requestDto
    ) {
        return ResponseEntity.ok(mediaFileService.uploadEncryptedFile(encryptedFile, requestDto));
    }

    @GetMapping("/{mediaFileId}")
    public ResponseEntity<MediaFileResponseDto> getMetadata(@PathVariable UUID mediaFileId) {
        return ResponseEntity.ok(mediaFileService.getMetadata(mediaFileId));
    }

    @GetMapping("/{mediaFileId}/download")
    public ResponseEntity<Resource> downloadEncryptedFile(@PathVariable UUID mediaFileId) throws Exception {
        StoredMediaResourceDto storedMediaResourceDto = mediaFileService.getEncryptedFile(mediaFileId);
        FileSystemResource fileSystemResource = new FileSystemResource(storedMediaResourceDto.path());
        String fileName = URLEncoder.encode(mediaFileId + ".bin", StandardCharsets.UTF_8);
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .contentLength(Files.size(storedMediaResourceDto.path()))
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + fileName)
            .header("X-Encrypted-Sha256", storedMediaResourceDto.encryptedSha256Base64())
            .body(fileSystemResource);
    }

    @PatchMapping("/{mediaFileId}/access")
    public ResponseEntity<Void> grantAccess(
        @PathVariable UUID mediaFileId,
        @Valid @RequestBody GrantMediaAccessRequestDto requestDto
    ) {
        mediaFileService.grantAccess(mediaFileId, requestDto);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{mediaFileId}")
    public ResponseEntity<Void> deleteOwnFile(@PathVariable UUID mediaFileId) {
        mediaFileService.deleteOwnFile(mediaFileId);
        return ResponseEntity.noContent().build();
    }
}

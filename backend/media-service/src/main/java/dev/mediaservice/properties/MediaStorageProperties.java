package dev.mediaservice.properties;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "application.media.storage")
public record MediaStorageProperties(
    @NotBlank
    String rootPath,

    @Min(1)
    long maxFileSizeBytes
) {}

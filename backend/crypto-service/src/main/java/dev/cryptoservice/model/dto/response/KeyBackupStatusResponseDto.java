package dev.cryptoservice.model.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

@Schema(description = "Response DTO for encrypted account key backup status.")
public record KeyBackupStatusResponseDto(
    @Schema(description = "Whether encrypted backup exists for current account.")
    boolean exists,

    @Schema(description = "Latest backup version. Null when backup does not exist.")
    Long backupVersion,

    @Schema(description = "Backup creation datetime. Null when backup does not exist.")
    OffsetDateTime createdAt,

    @Schema(description = "Backup update datetime. Null when backup does not exist.")
    OffsetDateTime updatedAt
) {}

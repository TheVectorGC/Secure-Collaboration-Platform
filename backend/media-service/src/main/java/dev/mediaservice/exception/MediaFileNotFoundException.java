package dev.mediaservice.exception;

import java.util.UUID;

public class MediaFileNotFoundException extends RuntimeException {
    public MediaFileNotFoundException(UUID mediaFileId) {
        super("Media file was not found. Media file ID: " + mediaFileId + ".");
    }
}

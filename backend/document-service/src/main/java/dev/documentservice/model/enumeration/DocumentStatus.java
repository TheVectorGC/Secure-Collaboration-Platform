package dev.documentservice.model.enumeration;

public enum DocumentStatus {
    ACTIVE,
    PENDING_SIGNATURES,
    PARTIALLY_SIGNED,
    FULLY_SIGNED,
    REJECTED,
    CANCELLED
}

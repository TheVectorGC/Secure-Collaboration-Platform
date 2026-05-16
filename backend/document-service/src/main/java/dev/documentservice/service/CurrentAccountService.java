package dev.documentservice.service;

import java.util.UUID;

public interface CurrentAccountService {
    UUID getCurrentAccountId();

    String getCurrentUsername();
}

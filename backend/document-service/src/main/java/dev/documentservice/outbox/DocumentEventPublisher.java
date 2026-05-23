package dev.documentservice.outbox;

import dev.documentservice.model.event.DocumentEventDto;

public interface DocumentEventPublisher {
    void publish(DocumentEventDto documentEventDto);
}

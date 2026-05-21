package dev.documentservice.publisher;

import dev.documentservice.model.event.DocumentEventDto;

public interface DocumentEventPublisher {
    void publish(DocumentEventDto documentEventDto);
}

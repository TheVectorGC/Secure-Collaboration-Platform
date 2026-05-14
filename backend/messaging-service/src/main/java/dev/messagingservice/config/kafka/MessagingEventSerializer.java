package dev.messagingservice.config.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import dev.messagingservice.model.event.MessagingEventDto;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import org.apache.kafka.common.serialization.Serializer;

public class MessagingEventSerializer implements Serializer<MessagingEventDto> {
    private final ObjectMapper objectMapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Override
    public byte[] serialize(String topic, MessagingEventDto messagingEventDto) {
        if (messagingEventDto == null) {
            return null;
        }

        try {
            ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
            objectMapper.writeValue(byteArrayOutputStream, messagingEventDto);
            return byteArrayOutputStream.toByteArray();
        }
        catch (IOException exception) {
            throw new UncheckedIOException("Failed to serialize messaging event.", exception);
        }
    }
}

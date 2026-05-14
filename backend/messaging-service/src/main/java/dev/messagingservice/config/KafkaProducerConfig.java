package dev.messagingservice.config;

import dev.messagingservice.config.kafka.MessagingEventSerializer;
import dev.messagingservice.model.event.MessagingEventDto;
import java.util.HashMap;
import java.util.Map;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

@Configuration
public class KafkaProducerConfig {
    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    @Bean
    public ProducerFactory<String, MessagingEventDto> messagingEventProducerFactory() {
        Map<String, Object> producerProperties = new HashMap<>();

        producerProperties.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        producerProperties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        producerProperties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, MessagingEventSerializer.class);
        producerProperties.put(ProducerConfig.ACKS_CONFIG, "all");
        producerProperties.put(ProducerConfig.RETRIES_CONFIG, 3);
        producerProperties.put(ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG, 5000);
        producerProperties.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 10000);
        producerProperties.put(ProducerConfig.MAX_BLOCK_MS_CONFIG, 5000);
        producerProperties.put(ProducerConfig.LINGER_MS_CONFIG, 0);

        return new DefaultKafkaProducerFactory<>(producerProperties);
    }

    @Bean
    public KafkaTemplate<String, MessagingEventDto> messagingEventKafkaTemplate(
            ProducerFactory<String, MessagingEventDto> messagingEventProducerFactory
    ) {
        return new KafkaTemplate<>(messagingEventProducerFactory);
    }
}
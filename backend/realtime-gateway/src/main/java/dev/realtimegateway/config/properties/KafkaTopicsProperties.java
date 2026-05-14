package dev.realtimegateway.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.kafka.topics")
public record KafkaTopicsProperties(
    String messagingEvents
) {}

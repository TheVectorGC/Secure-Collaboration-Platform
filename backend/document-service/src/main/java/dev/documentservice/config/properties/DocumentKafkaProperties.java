package dev.documentservice.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.kafka.topics")
public record DocumentKafkaProperties(String documentEvents) {}

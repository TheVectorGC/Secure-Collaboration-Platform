package dev.messagingservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableKafka
@EnableScheduling
@SpringBootApplication(excludeName = "org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration")
@ConfigurationPropertiesScan
public class MessagingServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(MessagingServiceApplication.class, args);
    }
}

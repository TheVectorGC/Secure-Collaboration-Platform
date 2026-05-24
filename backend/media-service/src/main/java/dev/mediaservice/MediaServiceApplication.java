package dev.mediaservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication(excludeName = "org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration")
@ConfigurationPropertiesScan
public class MediaServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(MediaServiceApplication.class, args);
    }
}

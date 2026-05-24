package dev.cryptoservice;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@Slf4j
@SpringBootApplication(excludeName = "org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration")
@ConfigurationPropertiesScan
public class CryptoServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CryptoServiceApplication.class, args);
    }
}

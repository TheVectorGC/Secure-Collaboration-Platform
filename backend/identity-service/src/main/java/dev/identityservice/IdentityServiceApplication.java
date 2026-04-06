package dev.identityservice;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@Slf4j
@SpringBootApplication
public class IdentityServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(IdentityServiceApplication.class, args);
	}

}

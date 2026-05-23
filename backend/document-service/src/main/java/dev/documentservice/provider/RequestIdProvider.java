package dev.documentservice.provider;

import org.slf4j.MDC;
import org.springframework.stereotype.Component;

@Component
public class RequestIdProvider {
    public static final String HEADER_NAME = "X-Request-Id";
    public static final String MDC_KEY = "requestId";

    public String getCurrentRequestId() {
        return MDC.get(MDC_KEY);
    }
}

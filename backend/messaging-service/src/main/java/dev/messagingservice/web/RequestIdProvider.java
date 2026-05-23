package dev.messagingservice.web;

import org.slf4j.MDC;
import org.springframework.stereotype.Component;

@Component
public class RequestIdProvider {
    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String REQUEST_ID_MDC_KEY = "requestId";

    public String getCurrentRequestId() {
        String requestId = MDC.get(REQUEST_ID_MDC_KEY);

        if (requestId == null || requestId.isBlank()) {
            return "none";
        }

        return requestId;
    }
}

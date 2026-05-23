package dev.cryptoservice.web;

import org.slf4j.MDC;
import org.springframework.stereotype.Component;

@Component
public class RequestIdProvider {
    public String getCurrentRequestId() {
        String requestId = MDC.get(RequestIdFilter.MDC_KEY);
        return requestId == null || requestId.isBlank() ? "none" : requestId;
    }
}

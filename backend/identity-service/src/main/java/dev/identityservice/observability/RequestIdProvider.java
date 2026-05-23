package dev.identityservice.observability;

import org.slf4j.MDC;
import org.springframework.stereotype.Component;

@Component
public class RequestIdProvider {
    public String currentRequestId() {
        String requestId = MDC.get(RequestIdFilter.REQUEST_ID_MDC_KEY);

        if (requestId == null || requestId.isBlank()) {
            return "none";
        }

        return requestId;
    }
}

package dev.mediaservice.observability;

import org.slf4j.MDC;
import org.springframework.stereotype.Component;

@Component
public class RequestIdProvider {
    public String getCurrentRequestId() {
        return MDC.get(RequestIdFilter.REQUEST_ID_MDC_KEY);
    }
}

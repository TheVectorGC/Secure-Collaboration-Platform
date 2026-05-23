package dev.realtimegateway.model.dto;

public record RealtimeGatewayInfoResponseDto(
        String webSocketEndpoint,
        String authentication,
        String heartbeat
) {}

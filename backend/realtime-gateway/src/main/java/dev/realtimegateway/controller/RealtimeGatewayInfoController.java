package dev.realtimegateway.controller;

import dev.realtimegateway.properties.WebSocketProperties;
import dev.realtimegateway.model.dto.RealtimeGatewayInfoResponseDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/realtime")
@RequiredArgsConstructor
@Tag(name = "Realtime Gateway", description = "Realtime gateway discovery endpoints.")
public class RealtimeGatewayInfoController {
    private final WebSocketProperties webSocketProperties;

    @GetMapping("/info")
    @Operation(
            summary = "Get realtime gateway connection information",
            description = "Returns the WebSocket endpoint and client heartbeat format used by Vector desktop clients."
    )
    @ApiResponse(responseCode = "200", description = "Realtime gateway connection information returned.")
    public ResponseEntity<RealtimeGatewayInfoResponseDto> getRealtimeGatewayInfo() {
        RealtimeGatewayInfoResponseDto realtimeGatewayInfoResponseDto = new RealtimeGatewayInfoResponseDto(
                webSocketProperties.endpoint(),
                "JWT access token in the accessToken query parameter.",
                "Send ping text frames and expect pong responses."
        );
        return ResponseEntity.ok(realtimeGatewayInfoResponseDto);
    }
}

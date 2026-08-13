package com.stockcal.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final Map<String, String> refreshOwners = new ConcurrentHashMap<>();

    @PostMapping("/verify")
    SessionResponse verify(@Valid @RequestBody VerifyRequest request) {
        if (!"123456".equals(request.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "验证码无效");
        }
        var access = token("access");
        var refresh = token("refresh");
        refreshOwners.put(refresh, request.phone());
        return new SessionResponse(
            access,
            refresh,
            Instant.now().plusSeconds(900),
            new Profile(request.phone(), "StockCal 用户"),
            new Device(UUID.randomUUID().toString(), request.deviceName(), Instant.now()));
    }

    @PostMapping("/refresh")
    TokenResponse refresh(@Valid @RequestBody RefreshRequest request) {
        if (!refreshOwners.containsKey(request.refreshToken())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "刷新令牌无效");
        }
        return new TokenResponse(token("access"), Instant.now().plusSeconds(900));
    }

    private String token(String type) {
        return type + "." + UUID.randomUUID();
    }

    record VerifyRequest(
        @Pattern(regexp = "^1\\d{10}$") String phone,
        @Pattern(regexp = "^\\d{6}$") String code,
        @NotBlank String deviceName) {}

    record RefreshRequest(@NotBlank String refreshToken) {}
    record Profile(String phone, String displayName) {}
    record Device(String id, String name, Instant lastSeenAt) {}
    record TokenResponse(String accessToken, Instant expiresAt) {}
    record SessionResponse(
        String accessToken,
        String refreshToken,
        Instant expiresAt,
        Profile profile,
        Device device) {}
}

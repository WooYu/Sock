package com.stockcal.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final JdbcClient jdbc;
    private final SmsChallengeService challenges;

    AuthController(JdbcClient jdbc, SmsChallengeService challenges) {
        this.jdbc = jdbc;
        this.challenges = challenges;
    }

    @PostMapping("/request-code")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void requestCode(@Valid @RequestBody CodeRequest request) {
        challenges.request(request.phone());
    }

    @PostMapping("/verify")
    SessionResponse verify(@Valid @RequestBody VerifyRequest request) {
        if (!challenges.consume(request.phone(), request.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "验证码无效");
        }
        var userId = userId(request.phone());
        var access = token("access");
        var refresh = token("refresh");
        var device = new Device(UUID.randomUUID().toString(), request.deviceName(), Instant.now());
        jdbc.sql("""
                insert into device_session (id, user_id, device_name, refresh_token_hash, last_seen_at)
                values (:id, :userId, :name, :hash, :seen)
                """)
            .param("id", device.id()).param("userId", userId).param("name", device.name())
            .param("hash", hash(refresh)).param("seen", device.lastSeenAt()).update();
        saveAccessToken(access, request.phone());
        return new SessionResponse(access, refresh, Instant.now().plusSeconds(900),
            new Profile(request.phone(), "StockCal 用户"), device);
    }

    @PostMapping("/refresh")
    TokenResponse refresh(@Valid @RequestBody RefreshRequest request) {
        var count = jdbc.sql("""
                update device_session set last_seen_at = :seen
                where refresh_token_hash = :hash and revoked_at is null
                """)
            .param("seen", Instant.now()).param("hash", hash(request.refreshToken())).update();
        if (count == 0) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "刷新令牌无效");
        }
        var access = token("access");
        var phone = jdbc.sql("""
                select u.phone from device_session d join app_user u on u.id = d.user_id
                where d.refresh_token_hash = :hash
                """).param("hash", hash(request.refreshToken())).query(String.class).single();
        saveAccessToken(access, phone);
        return new TokenResponse(access, Instant.now().plusSeconds(900));
    }

    @GetMapping("/devices")
    List<Device> devices(Principal principal) {
        return jdbc.sql("""
                select d.id, d.device_name, d.last_seen_at from device_session d
                join app_user u on u.id = d.user_id
                where u.phone = :phone and d.revoked_at is null order by d.last_seen_at desc
                """)
            .param("phone", principal.getName())
            .query((row, ignored) -> new Device(row.getString(1), row.getString(2),
                row.getTimestamp(3).toInstant())).list();
    }

    @DeleteMapping("/devices/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void revoke(Principal principal, @PathVariable String id) {
        jdbc.sql("""
                update device_session d set revoked_at = :revoked
                where d.id = :id and d.user_id in (select id from app_user where phone = :phone)
                """)
            .param("revoked", Instant.now()).param("id", id)
            .param("phone", principal.getName()).update();
    }

    private String userId(String phone) {
        var existing = jdbc.sql("select id from app_user where phone = :phone")
            .param("phone", phone).query(String.class).optional();
        if (existing.isPresent()) return existing.get();
        var id = UUID.randomUUID().toString();
        jdbc.sql("insert into app_user (id, phone, display_name) values (:id, :phone, :name)")
            .param("id", id).param("phone", phone).param("name", "StockCal 用户").update();
        return id;
    }

    private String token(String type) {
        return type + "." + UUID.randomUUID();
    }

    private String hash(String value) {
        return TokenHash.sha256(value);
    }

    private void saveAccessToken(String token, String phone) {
        jdbc.sql("insert into access_token (token_hash, phone, expires_at) values (:hash, :phone, :expires)")
            .param("hash", hash(token)).param("phone", phone)
            .param("expires", Instant.now().plusSeconds(900)).update();
    }

    record VerifyRequest(
        @Pattern(regexp = "^1\\d{10}$") String phone,
        @Pattern(regexp = "^\\d{6}$") String code,
        @NotBlank String deviceName) {}
    record CodeRequest(@Pattern(regexp = "^1\\d{10}$") String phone) {}
    record RefreshRequest(@NotBlank String refreshToken) {}
    record Profile(String phone, String displayName) {}
    record Device(String id, String name, Instant lastSeenAt) {}
    record TokenResponse(String accessToken, Instant expiresAt) {}
    record SessionResponse(String accessToken, String refreshToken, Instant expiresAt,
        Profile profile, Device device) {}
}

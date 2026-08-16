package com.stockcal.auth;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
class SmsChallengeService {
    private final JdbcClient jdbc;
    private final SmsGateway gateway;
    private final SecureRandom random = new SecureRandom();
    private final String devCode;

    SmsChallengeService(JdbcClient jdbc, SmsGateway gateway,
                        @Value("${stockcal.sms.dev-code:000000}") String devCode) {
        this.jdbc = jdbc;
        this.gateway = gateway;
        this.devCode = devCode;
    }

    void request(String phone) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        var recent = jdbc.sql("select requested_at from sms_challenge where phone=:phone")
            .param("phone", phone).query(OffsetDateTime.class).optional();
        if (recent.isPresent() && recent.get().isAfter(now.minusSeconds(60))) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "验证码请求过于频繁");
        }
        var code = devCode.isBlank()
            ? "%06d".formatted(random.nextInt(1_000_000))
            : devCode;
        gateway.sendCode(phone, code);
        jdbc.sql("delete from sms_challenge where phone=:phone").param("phone", phone).update();
        jdbc.sql("""
                insert into sms_challenge(phone,code_hash,expires_at,requested_at,attempts)
                values(:phone,:hash,:expires,:requested,0)
                """)
            .param("phone", phone).param("hash", hash(phone, code))
            .param("expires", now.plusSeconds(300)).param("requested", now).update();
    }

    boolean consume(String phone, String code) {
        var row = jdbc.sql("""
                select code_hash,expires_at,attempts,consumed_at from sms_challenge where phone=:phone
                """).param("phone", phone).query((rs, ignored) -> new Challenge(
                    rs.getString("code_hash"), rs.getObject("expires_at", OffsetDateTime.class).toInstant(),
                    rs.getInt("attempts"), rs.getObject("consumed_at") != null)).optional();
        if (row.isEmpty()) return false;
        var challenge = row.get();
        if (challenge.consumed() || challenge.expiresAt().isBefore(Instant.now()) || challenge.attempts() >= 5) {
            return false;
        }
        if (!challenge.codeHash().equals(hash(phone, code))) {
            jdbc.sql("update sms_challenge set attempts=attempts+1 where phone=:phone")
                .param("phone", phone).update();
            return false;
        }
        return jdbc.sql("""
                update sms_challenge set consumed_at=:now
                where phone=:phone and consumed_at is null
                """).param("now", OffsetDateTime.now(ZoneOffset.UTC)).param("phone", phone).update() == 1;
    }

    private String hash(String phone, String code) { return TokenHash.sha256(phone + ":" + code); }
    private record Challenge(String codeHash, Instant expiresAt, int attempts, boolean consumed) {}
}

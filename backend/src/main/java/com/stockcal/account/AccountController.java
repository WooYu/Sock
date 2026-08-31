package com.stockcal.account;

import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/account")
public class AccountController {
    private final JdbcClient jdbc;

    AccountController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    void delete(Principal principal) {
        var phone = principal.getName();
        var userId = jdbc.sql("select id from app_user where phone=:phone")
            .param("phone", phone).query(String.class).optional().orElse(null);
        if (userId == null) return;

        jdbc.sql("delete from sync_change where user_id=:phone")
            .param("phone", phone).update();
        jdbc.sql("delete from account_trade where user_id=:phone")
            .param("phone", phone).update();
        jdbc.sql("""
                delete from sync_mutation
                where user_id in (select id from app_user where phone=:phone)
                """).param("phone", phone).update();
        jdbc.sql("delete from ai_call_log where actor_id=:phone")
            .param("phone", phone).update();
        jdbc.sql("update audit_event set actor_id=null where actor_id=:phone or actor_id=:userId")
            .param("phone", phone).param("userId", userId).update();
        jdbc.sql("delete from access_token where phone=:phone").param("phone", phone).update();
        jdbc.sql("""
                delete from device_session
                where user_id in (select id from app_user where phone=:phone)
                """).param("phone", phone).update();
        jdbc.sql("delete from sms_challenge where phone=:phone").param("phone", phone).update();
        jdbc.sql("delete from app_user where phone=:phone").param("phone", phone).update();
    }
}

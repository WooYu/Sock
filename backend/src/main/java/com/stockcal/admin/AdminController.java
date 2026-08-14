package com.stockcal.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
    private final JdbcClient jdbc;
    private final String smsKey;
    private final String marketKey;
    private final String aiKey;

    AdminController(JdbcClient jdbc,
                    @Value("${stockcal.sms-api-key:}") String smsKey,
                    @Value("${stockcal.market-api-key:}") String marketKey,
                    @Value("${stockcal.ai-api-key:}") String aiKey) {
        this.jdbc = jdbc;
        this.smsKey = smsKey;
        this.marketKey = marketKey;
        this.aiKey = aiKey;
    }

    @GetMapping("/overview")
    Overview overview() {
        return new Overview(
            marketKey.isBlank() ? "行情服务未配置" : "A 股行情服务已配置",
            List.of(
                new SecretStatus("短信服务", !smsKey.isBlank()),
                new SecretStatus("行情服务", !marketKey.isBlank()),
                new SecretStatus("AI 服务", !aiKey.isBlank())
            )
        );
    }

    @GetMapping("/jobs")
    List<AdminJob> jobs() {
        return jdbc.sql("""
                select id,type,target,status,attempts,error,updated_at
                from admin_job order by updated_at desc
                """).query((row, ignored) -> new AdminJob(
                    row.getString("id"), row.getString("type"), row.getString("target"),
                    row.getString("status"), row.getInt("attempts"), row.getString("error"),
                    row.getTimestamp("updated_at").toInstant())).list();
    }

    @PostMapping("/jobs/{id}/retry")
    @Transactional
    AdminJob retry(Principal principal, @PathVariable String id) {
        var updated = jdbc.sql("""
                update admin_job set status='QUEUED',attempts=attempts+1,error=null,updated_at=:now
                where id=:id and status='FAILED'
                """).param("now", Instant.now()).param("id", id).update();
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "任务不存在或不可重试");
        }
        audit(principal.getName(), "RETRY_ADMIN_JOB", id);
        return job(id);
    }

    @PostMapping("/market-repairs")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Transactional
    AdminJob repair(Principal principal, @Valid @RequestBody RepairRequest request) {
        var now = Instant.now();
        var id = UUID.randomUUID().toString();
        jdbc.sql("""
                insert into admin_job(id,type,target,status,attempts,error,created_at,updated_at)
                values(:id,'MARKET_REPAIR',:target,'QUEUED',0,null,:now,:now)
                """).param("id", id).param("target", request.stockCode()).param("now", now).update();
        audit(principal.getName(), "CREATE_MARKET_REPAIR", request.stockCode());
        return job(id);
    }

    @GetMapping("/users")
    List<ManagedUser> users() {
        return jdbc.sql("""
                select id,phone,display_name,role,enabled from app_user order by created_at
                """).query((row, ignored) -> new ManagedUser(
                    row.getString("id"), mask(row.getString("phone")),
                    row.getString("display_name"), row.getString("role"),
                    row.getBoolean("enabled"))).list();
    }

    @PatchMapping("/users/{id}/role")
    @Transactional
    ManagedUser role(Principal principal, @PathVariable String id,
                     @Valid @RequestBody RoleRequest request) {
        var updated = jdbc.sql("update app_user set role=:role where id=:id")
            .param("role", request.role()).param("id", id).update();
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        audit(principal.getName(), "SET_USER_ROLE", id);
        return jdbc.sql("select id,phone,display_name,role,enabled from app_user where id=:id")
            .param("id", id).query((row, ignored) -> new ManagedUser(
                row.getString("id"), mask(row.getString("phone")),
                row.getString("display_name"), row.getString("role"),
                row.getBoolean("enabled"))).single();
    }

    private AdminJob job(String id) {
        return jdbc.sql("""
                select id,type,target,status,attempts,error,updated_at from admin_job where id=:id
                """).param("id", id).query((row, ignored) -> new AdminJob(
                    row.getString("id"), row.getString("type"), row.getString("target"),
                    row.getString("status"), row.getInt("attempts"), row.getString("error"),
                    row.getTimestamp("updated_at").toInstant())).single();
    }

    private void audit(String actor, String action, String target) {
        jdbc.sql("""
                insert into audit_event(id,actor_id,action,target,evidence,created_at)
                values(:id,:actor,:action,:target,'{}',:now)
                """).param("id", UUID.randomUUID().toString()).param("actor", actor)
            .param("action", action).param("target", target).param("now", Instant.now()).update();
    }

    private String mask(String phone) {
        return phone.length() == 11 ? phone.substring(0, 3) + "****" + phone.substring(7) : phone;
    }

    record Overview(String marketStatus, List<SecretStatus> secrets) {}
    record SecretStatus(String name, boolean configured) {}
    record AdminJob(String id, String type, String target, String status, int attempts,
                    String error, Instant updatedAt) {}
    record ManagedUser(String id, String phoneMasked, String displayName, String role,
                       boolean enabled) {}
    record RepairRequest(@Pattern(regexp = "^\\d{6}$") String stockCode) {}
    record RoleRequest(@Pattern(regexp = "^(USER|ANALYST|ADMIN)$") String role) {}
}

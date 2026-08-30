package com.stockcal.analysis;

import java.security.Principal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analysis")
public class StrategyExplanationController {
    private final StrategyExplanationClient client;
    private final JdbcClient jdbc;
    private final String model;

    StrategyExplanationController(
        StrategyExplanationClient client,
        JdbcClient jdbc,
        @Value("${stockcal.ai.model:deepseek-chat}") String model
    ) {
        this.client = client;
        this.jdbc = jdbc;
        this.model = model;
    }

    @PostMapping("/strategy-explanation")
    StrategyExplanation explain(
        Principal principal,
        @RequestBody StrategyExplanationRequest request
    ) {
        var actor = principal == null ? "anonymous" : principal.getName();
        try {
            var response = client.explain(request);
            audit(actor, "SUCCEEDED");
            return response;
        } catch (RuntimeException error) {
            audit(actor, "FAILED");
            throw error;
        }
    }

    private void audit(String actor, String status) {
        jdbc.sql("""
                insert into ai_call_log(id,actor_id,purpose,model,status,created_at)
                values(:id,:actor,'STRATEGY_EXPLANATION',:model,:status,:now)
                """)
            .param("id", UUID.randomUUID().toString())
            .param("actor", actor)
            .param("model", model)
            .param("status", status)
            .param("now", OffsetDateTime.now(ZoneOffset.UTC))
            .update();
    }
}

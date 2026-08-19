package com.stockcal.review;

import jakarta.validation.Valid;
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
@RequestMapping("/api/v1/reviews")
public class ReviewAiController {
    private final ReviewExplanationClient client;
    private final JdbcClient jdbc;
    private final String model;

    ReviewAiController(ReviewExplanationClient client, JdbcClient jdbc,
                       @Value("${stockcal.ai.model:gpt-4o-mini}") String model) {
        this.client = client;
        this.jdbc = jdbc;
        this.model = model;
    }

    @PostMapping("/explain")
    Explanation explain(Principal principal, @Valid @RequestBody ReviewSnapshot snapshot) {
        try {
            var text = client.explain(snapshot);
            audit(principal.getName(), "SUCCEEDED");
            return new Explanation(text);
        } catch (RuntimeException error) {
            audit(principal.getName(), "FAILED");
            throw error;
        }
    }

    private void audit(String actor, String status) {
        jdbc.sql("""
                insert into ai_call_log(id,actor_id,purpose,model,status,created_at)
                values(:id,:actor,'REVIEW_EXPLANATION',:model,:status,:now)
                """).param("id", UUID.randomUUID().toString()).param("actor", actor)
            .param("model", model).param("status", status).param("now", OffsetDateTime.now(ZoneOffset.UTC)).update();
    }

    record Explanation(String text) {}
}

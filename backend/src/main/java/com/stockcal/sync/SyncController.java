package com.stockcal.sync;

import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sync")
public class SyncController {
    private final JdbcSyncStore store;

    SyncController(JdbcSyncStore store) {
        this.store = store;
    }

    @PostMapping("/mutations")
    ApplyResponse apply(Principal principal,
                        @RequestHeader(value = "X-Client-Id", required = false) String clientId,
                        @Valid @RequestBody SyncMutation request) {
        return store.apply(identity(principal, clientId), request);
    }

    @GetMapping("/changes")
    PullResponse pull(Principal principal,
                      @RequestHeader(value = "X-Client-Id", required = false) String clientId,
                      @RequestParam(defaultValue = "0") long cursor) {
        return store.pull(identity(principal, clientId), cursor);
    }

    private String identity(Principal principal, String clientId) {
        if (principal != null) return principal.getName();
        if (clientId == null || clientId.isBlank() || clientId.length() > 100) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "X-Client-Id is required");
        }
        return "web:" + clientId;
    }
}

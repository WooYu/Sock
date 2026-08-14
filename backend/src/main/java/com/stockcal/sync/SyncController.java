package com.stockcal.sync;

import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sync")
public class SyncController {
    private final JdbcSyncStore store;

    SyncController(JdbcSyncStore store) {
        this.store = store;
    }

    @PostMapping("/mutations")
    ApplyResponse apply(Principal principal, @Valid @RequestBody SyncMutation request) {
        return store.apply(principal.getName(), request);
    }

    @GetMapping("/changes")
    PullResponse pull(Principal principal, @RequestParam(defaultValue = "0") long cursor) {
        return store.pull(principal.getName(), cursor);
    }
}

package com.stockcal.sync;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;

@SpringBootTest
class JdbcSyncStoreTest {
    @Autowired JdbcClient jdbc;
    @Autowired JdbcSyncStore store;

    @BeforeEach
    void reset() {
        jdbc.sql("delete from sync_change").update();
    }

    @Test
    void persistsIdempotentChangesAndPullsAfterCursor() {
        var first = store.apply("user-1", new SyncMutation(
            "watch:add:1", "WATCHLIST", "g1", "UPSERT", 1, Map.of("name", "重点关注")));
        var duplicate = store.apply("user-1", new SyncMutation(
            "watch:add:1", "WATCHLIST", "g1", "UPSERT", 1, Map.of("name", "重点关注")));

        assertThat(first.applied()).isTrue();
        assertThat(duplicate.applied()).isFalse();
        assertThat(store.pull("user-1", 0).changes()).hasSize(1);
        assertThat(store.pull("user-1", first.cursor()).changes()).isEmpty();
    }
}

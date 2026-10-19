package com.stockcal.knowledge;

import static org.junit.jupiter.api.Assertions.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class NoteTagExtractionControllerTest {
    @Test
    void rejectsInvalidIdentityWithoutContactingWorker() {
        var controller = new NoteTagExtractionController("http://127.0.0.1:1/extract");
        assertEquals(400, controller.extract(new NoteTagExtractionController.ExtractionRequest("../secret", "a".repeat(64))).getStatusCode().value());
        assertEquals(400, controller.extract(new NoteTagExtractionController.ExtractionRequest("note:test.md", "stale")).getStatusCode().value());
    }

    @Test
    void forwardsOnlyIdentityAndPreservesWorkerStatusAndJson() throws Exception {
        var received = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/extract", exchange -> {
            received.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = "{\"candidate\":null,\"models\":[]}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(429, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            var controller = new NoteTagExtractionController("http://127.0.0.1:" + server.getAddress().getPort() + "/extract");
            var response = controller.extract(new NoteTagExtractionController.ExtractionRequest("note:a\"b.md", "a".repeat(64)));
            assertEquals(429, response.getStatusCode().value());
            assertEquals("{\"candidate\":null,\"models\":[]}", response.getBody());
            assertTrue(received.get().contains("note:a\\\"b.md"));
            assertFalse(received.get().contains("sourceText"));
        } finally { server.stop(0); }
    }

    @Test
    void reportsUnreachableWorkerWithoutLeakingConnectionDetails() {
        var controller = new NoteTagExtractionController("http://127.0.0.1:1/extract");
        var response = controller.extract(new NoteTagExtractionController.ExtractionRequest("note:test.md", "a".repeat(64)));
        assertEquals(502, response.getStatusCode().value());
        assertFalse(response.getBody().contains("127.0.0.1"));
    }
}

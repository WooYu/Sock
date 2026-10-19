package com.stockcal.knowledge;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class NoteTagExtractionController {
    private final URI worker;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    NoteTagExtractionController(@Value("${stockcal.tags.worker-url:http://tag-worker:3010/extract}") String workerUrl) {
        worker = URI.create(workerUrl);
    }

    public record ExtractionRequest(String id, String sourceHash) {}

    @PostMapping(value = "/api/v1/note-tag-suggestions", produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<String> suggest(@RequestBody String body) {
        if (body.length() > 65000) return ResponseEntity.status(413).body("{\"message\":\"输入过长\"}");
        return callWorker(worker.resolve("/suggest"), body);
    }

    @PostMapping(value = "/api/v1/note-tag-extraction", produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<String> extract(@RequestBody ExtractionRequest input) {
        if (input.id() == null || !input.id().startsWith("note:") || input.id().length() > 512
                || input.sourceHash() == null || !input.sourceHash().matches("[a-f0-9]{64}")) {
            return ResponseEntity.badRequest().body("{\"message\":\"笔记身份或原文版本无效\"}");
        }
        // JSON escaping keeps note names as data; the worker resolves only catalog IDs.
        var body = "{\"id\":\"" + escape(input.id()) + "\",\"sourceHash\":\"" + input.sourceHash() + "\"}";
        return callWorker(worker, body);
    }

    private ResponseEntity<String> callWorker(URI destination, String body) {
        try {
            var request = HttpRequest.newBuilder(destination).timeout(Duration.ofSeconds(280))
                .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return ResponseEntity.status(response.statusCode()).body(response.body());
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return unavailable();
        } catch (Exception error) {
            return unavailable();
        }
    }

    private static String escape(String value) {
        var result = new StringBuilder();
        for (char c : value.toCharArray()) {
            if (c == '"' || c == '\\') result.append('\\').append(c);
            else if (c < 0x20) result.append(String.format("\\u%04x", (int) c));
            else result.append(c);
        }
        return result.toString();
    }

    private static ResponseEntity<String> unavailable() {
        return ResponseEntity.status(502).body("{\"message\":\"双 AI 提取服务暂时不可用，请稍后重试\"}");
    }
}

package com.stockcal.knowledge;

import java.time.Instant;
import java.nio.file.Path;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
class KnowledgeConfiguration {
    @Bean
    KnowledgeWorkflow knowledgeWorkflow(
        JdbcKnowledgeRepository repository,
        @Value("${stockcal.ai.enabled:true}") boolean aiEnabled,
        @Value("${stockcal.ai-api-key:}") String apiKey,
        @Value("${stockcal.ai.base-url:https://api.deepseek.com}") String baseUrl,
        @Value("${stockcal.ai.model:deepseek-chat}") String model
    ) {
        KnowledgeExtractor extractor = aiEnabled && !apiKey.isBlank()
            ? new OpenAiKnowledgeExtractor(new ChatCompletionsKnowledgeClient(
                RestClient.builder().build(), baseUrl, apiKey, model))
            : new NoteExtractor();
        return new KnowledgeWorkflow(repository, extractor, Instant::now);
    }

    @Bean
    ApplicationRunner noteDirectoryImportRunner(
        KnowledgeWorkflow workflow,
        @Value("${stockcal.knowledge.notes-path:}") String notesPath
    ) {
        return arguments -> {
            if (!notesPath.isBlank()) new NoteDirectoryImporter(workflow).scan(Path.of(notesPath));
        };
    }
}

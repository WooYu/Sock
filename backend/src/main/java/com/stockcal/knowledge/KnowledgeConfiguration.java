package com.stockcal.knowledge;

import java.time.Instant;
import java.nio.file.Path;
import java.util.Set;
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
        @Value("${stockcal.knowledge.notes-path:}") String notesPath,
        @Value("${stockcal.knowledge.auto-extract:true}") boolean autoExtract
    ) {
        return arguments -> {
            if (notesPath.isBlank()) return;
            new NoteDirectoryImporter(workflow).scan(Path.of(notesPath));
            if (!autoExtract) return;
            var coreNames = Set.of(
                "买股原则.md", "买股原则2.md", "五日线.md", "海龟.md", "海龟_1.md",
                "十不做.md", "盈利模式.md", "参数计算.md", "参数计算注意点（20251023-晚评）.md",
                "四期第五课-摸线八字箴言.md", "四期第二课-关键点（目标位）.md",
                "20220915_收盘_月线炒股法.md"
            );
            workflow.sources().stream()
                .filter(source -> coreNames.contains(Path.of(source.path()).getFileName().toString()))
                .forEach(source -> {
                    try {
                        workflow.extract(source.id());
                    } catch (RuntimeException exception) {
                        // One bad note or unavailable AI service must not stop Aliyun startup.
                    }
                });
        };
    }
}

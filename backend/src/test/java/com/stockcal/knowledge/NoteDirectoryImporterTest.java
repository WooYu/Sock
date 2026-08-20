package com.stockcal.knowledge;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class NoteDirectoryImporterTest {
    @TempDir java.nio.file.Path directory;

    @Test
    void scansMarkdownRecursivelyAndReportsUnchangedSources() throws Exception {
        Files.writeString(directory.resolve("关键点.md"), "关键点规则：触达目标位减仓。");
        Files.createDirectories(directory.resolve("案例"));
        Files.writeString(directory.resolve("案例/海龟.md"), "海龟是筑底形态。");
        Files.writeString(directory.resolve("案例/忽略.txt"), "不应导入");
        var workflow = new KnowledgeWorkflow(new InMemoryKnowledgeRepository(), new NoteExtractor(),
            () -> Instant.parse("2026-08-14T10:00:00Z"));
        var importer = new NoteDirectoryImporter(workflow);

        var first = importer.scan(directory);
        var second = importer.scan(directory);

        assertThat(first.discovered()).isEqualTo(2);
        assertThat(first.imported()).isEqualTo(2);
        assertThat(second.discovered()).isEqualTo(2);
        assertThat(second.imported()).isZero();
        assertThat(second.unchanged()).isEqualTo(2);
        assertThat(workflow.sources()).extracting(SourceDocument::path)
            .containsExactlyInAnyOrder("关键点.md", "案例/海龟.md");
    }
}

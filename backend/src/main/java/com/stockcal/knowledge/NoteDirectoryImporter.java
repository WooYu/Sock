package com.stockcal.knowledge;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;

final class NoteDirectoryImporter {
    private final KnowledgeWorkflow workflow;
    NoteDirectoryImporter(KnowledgeWorkflow workflow) { this.workflow = workflow; }

    ScanResult scan(Path root) {
        if (!Files.isDirectory(root)) throw new IllegalArgumentException("笔记目录不存在");
        try (var paths = Files.walk(root)) {
            var markdown = paths.filter(Files::isRegularFile)
                .filter(path -> path.getFileName().toString().toLowerCase().endsWith(".md"))
                .sorted(Comparator.comparing(Path::toString)).toList();
            var imported = 0;
            for (var path : markdown) {
                var before = workflow.sources().size();
                var relative = root.relativize(path);
                var source = workflow.importNote(relative, Files.readString(path, StandardCharsets.UTF_8));
                workflow.extract(source.id());
                if (workflow.sources().size() > before) imported++;
            }
            return new ScanResult(markdown.size(), imported, markdown.size() - imported);
        } catch (IOException exception) {
            throw new IllegalStateException("读取笔记目录失败", exception);
        }
    }

    record ScanResult(int discovered, int imported, int unchanged) {}
}

package com.stockcal.knowledge;

import java.nio.file.Path;
import java.security.Principal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/knowledge")
public class KnowledgeController {
    private final KnowledgeWorkflow workflow;
    KnowledgeController(KnowledgeWorkflow workflow) { this.workflow = workflow; }

    record ImportRequest(String path, String content) {}
    record UpdateSourceRequest(String content) {}
    record UpdateDraftRequest(String title, String summary) {}
    record ToggleRuleRequest(boolean enabled) {}

    @PostMapping("/sources")
    @ResponseStatus(HttpStatus.CREATED)
    SourceDocument importSource(@RequestBody ImportRequest request) {
        return workflow.importNote(Path.of(request.path()), request.content());
    }
    @GetMapping("/sources")
    List<SourceDocument> sources() { return workflow.sources(); }
    @PostMapping("/sources/{id}/extract")
    List<KnowledgeDraft> extract(@PathVariable String id) { return workflow.extract(id); }
    @GetMapping("/drafts")
    List<KnowledgeDraft> drafts(@RequestParam(required = false) ApprovalStatus status) {
        return workflow.drafts(status);
    }
    @PostMapping("/drafts/{id}/approve")
    KnowledgeDraft approve(@PathVariable String id, Principal principal) {
        return workflow.approve(id, principal.getName());
    }
    @PostMapping("/drafts/{id}/publish")
    @ResponseStatus(HttpStatus.CREATED)
    PublishedRule publish(@PathVariable String id) { return workflow.publishRule(id); }

    @PatchMapping("/sources/{id}")
    SourceDocument updateSource(@PathVariable String id, @RequestBody UpdateSourceRequest request) {
        return workflow.updateSource(id, request.content());
    }
    @DeleteMapping("/sources/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteSource(@PathVariable String id) { workflow.deleteSource(id); }
    @PatchMapping("/drafts/{id}")
    KnowledgeDraft updateDraft(@PathVariable String id, @RequestBody UpdateDraftRequest request) {
        return workflow.updateDraft(id, request.title(), request.summary());
    }
    @GetMapping("/rules")
    List<PublishedRule> rules() { return workflow.rules(); }
    @PatchMapping("/rules/{id}/enabled")
    PublishedRule toggleRule(@PathVariable String id, @RequestBody ToggleRuleRequest request) {
        return workflow.toggleRule(id, request.enabled());
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    void conflict() {}
}

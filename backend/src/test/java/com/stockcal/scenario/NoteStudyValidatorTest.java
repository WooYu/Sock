package com.stockcal.scenario;

import static org.assertj.core.api.Assertions.*;
import static com.stockcal.scenario.ScenarioContracts.*;
import org.junit.jupiter.api.Test;

class NoteStudyValidatorTest {
    static StudyImport valid() {
        String source="第一行\nMA5支撑\n";
        var payload=ResearchJson.JSON.readTree("""
            {"status":"ai_candidate","tags":["topic.ma5"],"evidence":[{"tagId":"topic.ma5","startLine":2,"endLine":2,"quote":"MA5支撑"}],
            "claims":[{"evaluationStatus":"untested","evidence":[{"startLine":2,"endLine":2,"quote":"MA5支撑"}]}]}
            """);
        return new StudyImport("sample.md",ResearchJson.hash(source),source,"https://example.org/note","ai_semantic",null,null,payload);
    }
    @Test void verifiesByteHashAndEveryQuote() {
        var v=new NoteStudyValidator();v.validate(valid());
        var s=valid();
        assertThatThrownBy(()->v.validate(new StudyImport(s.sourceFile(),"a".repeat(64),s.sourceText(),s.sourceUrl(),s.channel(),null,null,s.payload()))).isInstanceOf(IllegalArgumentException.class);
        var payload=s.payload().deepCopy();((tools.jackson.databind.node.ObjectNode)payload.path("claims").get(0).path("evidence").get(0)).put("startLine",1).put("endLine",1);
        assertThatThrownBy(()->v.validate(new StudyImport(s.sourceFile(),s.sourceHash(),s.sourceText(),s.sourceUrl(),s.channel(),null,null,payload))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void rejectsUnknownTagsAndFakePerformanceConfirmation() {
        var s=valid();var payload=s.payload().deepCopy();((tools.jackson.databind.node.ArrayNode)payload.path("tags")).add("unknown.tag");
        assertThatThrownBy(()->new NoteStudyValidator().validate(new StudyImport(s.sourceFile(),s.sourceHash(),s.sourceText(),s.sourceUrl(),s.channel(),null,null,payload))).isInstanceOf(IllegalArgumentException.class);
        var fake=s.payload().deepCopy();((tools.jackson.databind.node.ObjectNode)fake.path("claims").get(0)).put("evaluationStatus","proven");
        assertThatThrownBy(()->new NoteStudyValidator().validate(new StudyImport(s.sourceFile(),s.sourceHash(),s.sourceText(),s.sourceUrl(),s.channel(),null,null,fake))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void vocabularyResourceMatchesProductTaxonomy() throws Exception {
        var taxonomy=ResearchJson.JSON.readTree(java.nio.file.Files.readString(java.nio.file.Path.of("../frontend/src/features/knowledge/note-tag-taxonomy.json")));
        var expected=new java.util.TreeSet<String>();for(var dim:taxonomy)for(var tag:dim.path("options"))expected.add(tag.path("id").asText());
        assertThat(new NoteStudyValidator().allowedTags()).containsExactlyElementsOf(expected);
    }
    @Test void rejectsMissingOrMalformedTagAndClaimQuotes() {
        var cases=java.util.List.<java.util.function.Consumer<tools.jackson.databind.node.ObjectNode>>of(
            p->((tools.jackson.databind.node.ObjectNode)p.path("evidence").get(0)).remove("quote"),
            p->((tools.jackson.databind.node.ObjectNode)p.path("evidence").get(0)).remove("startLine"),
            p->((tools.jackson.databind.node.ObjectNode)p.path("evidence").get(0)).remove("endLine"),
            p->p.putObject("evidence"),
            p->((tools.jackson.databind.node.ObjectNode)p.path("claims").get(0)).putArray("evidence"),
            p->((tools.jackson.databind.node.ObjectNode)p.path("claims").get(0)).putObject("evidence"),
            p->((tools.jackson.databind.node.ObjectNode)p.path("claims").get(0).path("evidence").get(0)).remove("quote"),
            p->p.putObject("claims")
        );
        for(var mutation:cases) {
            var s=valid();var payload=(tools.jackson.databind.node.ObjectNode)s.payload().deepCopy();mutation.accept(payload);
            assertThatThrownBy(()->new NoteStudyValidator().validate(new StudyImport(s.sourceFile(),s.sourceHash(),s.sourceText(),s.sourceUrl(),s.channel(),null,null,payload)))
                .as(payload.toString()).isInstanceOf(IllegalArgumentException.class);
        }
    }
}

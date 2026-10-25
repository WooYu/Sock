package com.stockcal.scenario;

import static com.stockcal.scenario.ScenarioContracts.*;
import static com.stockcal.scenario.ScenarioRecordValidator.require;
import java.util.*;
import tools.jackson.databind.JsonNode;

public final class NoteStudyValidator {
    private final SortedSet<String> allowed=new TreeSet<>();
    public NoteStudyValidator() {
        var resource=getClass().getResourceAsStream("/scenario/note-tag-ids.json");
        if(resource==null)throw new IllegalStateException("笔记词表资源缺失");
        ResearchJson.JSON.readTree(resource).forEach(n->allowed.add(n.asText()));
    }
    public SortedSet<String> allowedTags(){return Collections.unmodifiableSortedSet(allowed);}
    public void validate(StudyImport input) {
        require(input!=null && input.sourceText()!=null && input.sourceText().length()<=2_000_000,"原文缺失或过大");
        require(input.sourceHash()!=null && input.sourceHash().equals(ResearchJson.hash(input.sourceText())),"原文字节哈希不匹配");
        require(input.sourceFile()!=null && !input.sourceFile().isBlank() && input.sourceFile().length()<=1000,"来源文件无效");
        require(input.sourceUrl()!=null && input.sourceUrl().startsWith("https://"),"原文URL无效");
        require(input.channel()!=null && Set.of("ai_semantic","manual","legacy").contains(input.channel()),"研究通道无效");
        require(input.payload()!=null && input.payload().isObject(),"研究内容缺失");
        var tags=input.payload().path("tags");require(tags.isArray() && !tags.isEmpty(),"标签缺失");
        var seen=new HashSet<String>();
        for(var tag:tags)require(allowed.contains(tag.asText()) && seen.add(tag.asText()),"未知或重复标签");
        var evidence=input.payload().path("evidence");require(evidence.isArray(),"标签引文缺失");
        for(var tag:seen)require(stream(evidence).anyMatch(e->tag.equals(e.path("tagId").asText())),"标签缺少引文");
        var lines=input.sourceText().split("\\r?\\n",-1);
        for(var e:evidence) {require(seen.contains(e.path("tagId").asText()),"引文标签未选用");validateQuote(e,lines);}
        var claims=input.payload().path("claims");
        require(!input.payload().has("claims") || claims.isArray(),"计算主张列表格式无效");
        for(var claim:claims) {
            require(claim.isObject() && "untested".equals(claim.path("evaluationStatus").asText()),"研究导入不能声明效果已证实");
            var quotes=claim.path("evidence");require(quotes.isArray() && !quotes.isEmpty(),"计算主张缺少原文引文");
            quotes.forEach(e->validateQuote(e,lines));
        }
        walkQuotes(input.payload(),lines);
        var key=input.legacyKey();
        if(key!=null)require("legacy".equals(input.channel()) && Objects.equals(key.sourceHash(),input.sourceHash()) && Objects.equals(key.channel(),input.channel())
            && key.level()!=null && Set.of("document","fragment").contains(key.level()) && key.tagVersion()>0 && key.legacyRecordId()!=null && key.legacyRecordId().length()<=180,"旧引用键无效");
    }
    private void walkQuotes(JsonNode node,String[] lines) {
        if(node.isObject()) {
            if(node.has("quote"))validateQuote(node,lines);
            node.properties().forEach(e->walkQuotes(e.getValue(),lines));
        }else if(node.isArray())node.forEach(n->walkQuotes(n,lines));
    }
    private void validateQuote(JsonNode node,String[] lines) {
        require(node.isObject() && node.path("quote").isString() && node.path("startLine").isIntegralNumber() && node.path("endLine").isIntegralNumber(),"引文内容或行号缺失");
        int from=node.path("startLine").asInt(),through=node.path("endLine").asInt();String quote=node.path("quote").asText();
        require(from>=1 && through>=from && through<=lines.length && !quote.isBlank(),"引文行范围无效");
        require(String.join("\n",Arrays.copyOfRange(lines,from-1,through)).contains(quote),"引文不在该版本原文行范围内");
    }
    private static java.util.stream.Stream<JsonNode> stream(JsonNode n){return java.util.stream.StreamSupport.stream(n.spliterator(),false);}
}

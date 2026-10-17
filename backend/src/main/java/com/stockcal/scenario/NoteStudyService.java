package com.stockcal.scenario;

import static com.stockcal.scenario.ScenarioContracts.*;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class NoteStudyService {
    private final JdbcClient jdbc;
    private final NoteStudyValidator validator=new NoteStudyValidator();
    public NoteStudyService(JdbcClient jdbc){this.jdbc=jdbc;}
    public NoteStudyRevision importRevision(String owner,StudyImport input) {
        validator.validate(input);
        if(input.parentRevisionId()!=null) {
            var parent=findOwned(owner,input.parentRevisionId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
            ScenarioRecordValidator.require(parent.sourceFile().equals(input.sourceFile()),"父研究来源文件不一致");
        }
        String hash=ResearchJson.hash(ResearchJson.canonical(input));
        var key=input.legacyKey();
        var record=new NoteStudyRevision(UUID.randomUUID().toString(),owner,input.sourceFile(),input.sourceHash(),input.sourceText(),input.sourceUrl(),
            input.channel(),input.parentRevisionId(),key,Instant.now(),hash,input.payload().deepCopy());
        jdbc.sql("""
            insert into note_study_revision (id,owner_id,source_file,source_hash,source_text,source_url,channel,parent_revision_id,created_at,
            tag_ids,legacy_record_id,legacy_level,legacy_tag_version,study_payload_hash,study_payload_text)
            values (:id,:owner,:file,:hash,:text,:url,:channel,:parent,:created,:tags,:legacy,:level,:tagVersion,:payloadHash,:payload)
            on conflict do nothing
            """).param("id",record.id()).param("owner",owner).param("file",input.sourceFile()).param("hash",input.sourceHash())
            .param("text",input.sourceText()).param("url",input.sourceUrl()).param("channel",input.channel()).param("parent",input.parentRevisionId())
            .param("created",java.sql.Timestamp.from(record.createdAt())).param("tags",ResearchJson.canonical(input.payload().path("tags")))
            .param("legacy",key==null?null:key.legacyRecordId()).param("level",key==null?null:key.level()).param("tagVersion",key==null?null:key.tagVersion())
            .param("payloadHash",hash).param("payload",ResearchJson.JSON.writeValueAsString(record)).update();
        var found=jdbc.sql("select study_payload_text from note_study_revision where owner_id=:owner and study_payload_hash=:hash")
            .param("owner",owner).param("hash",hash).query(String.class).optional();
        if(found.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"同一旧笔记版本内容冲突");
        return ResearchJson.JSON.readValue(found.get(),NoteStudyRevision.class);
    }
    public Optional<NoteStudyRevision> findOwned(String owner,String id) {
        return jdbc.sql("select study_payload_text from note_study_revision where owner_id=:owner and id=:id")
            .param("owner",owner).param("id",id).query(String.class).optional().map(s->ResearchJson.JSON.readValue(s,NoteStudyRevision.class));
    }
    public List<NoteStudyRevision> list(String owner,String file) {
        return jdbc.sql("select study_payload_text from note_study_revision where owner_id=:owner and (:file='' or source_file=:file) order by created_at desc,id desc limit 500")
            .param("owner",owner).param("file",file==null?"":file).query(String.class).list().stream().map(s->ResearchJson.JSON.readValue(s,NoteStudyRevision.class)).toList();
    }
    public Page<NoteStudyRevision> page(String owner,String file,String rawCursor,int limit) {
        ScenarioRecordValidator.require(limit>=1 && limit<=100,"分页数量须为1至100");
        String selectedFile=file==null?"":file;var cursor=ResearchCursor.read(rawCursor,ResearchJson.hash(ResearchJson.canonical(Map.of("kind","studies","owner",owner,"file",selectedFile))),jdbc);
        record Row(NoteStudyRevision study,Instant position){}
        var rows=jdbc.sql("""
            select study_payload_text,created_at from note_study_revision where owner_id=:owner and (:file='' or source_file=:file) and created_at<=:asof
            and pg_visible_in_snapshot(created_xid,cast(:snapshot as pg_snapshot))
            and (:hasCursor=false or created_at<:position or (created_at=:position and id<:id)) order by created_at desc,id desc limit :limit
            """).param("owner",owner).param("file",selectedFile).param("asof",java.sql.Timestamp.from(cursor.asOf())).param("snapshot",cursor.visibilitySnapshot()).param("hasCursor",cursor.positionTime()!=null)
            .param("position",java.sql.Timestamp.from(cursor.positionTime()==null?cursor.asOf():cursor.positionTime())).param("id",cursor.positionId()==null?"":cursor.positionId()).param("limit",limit+1)
            .query((r,n)->new Row(ResearchJson.JSON.readValue(r.getString("study_payload_text"),NoteStudyRevision.class),r.getTimestamp("created_at").toInstant())).list();
        var selected=rows.subList(0,Math.min(limit,rows.size()));var last=selected.isEmpty()?null:selected.getLast();
        return new Page<>(selected.stream().map(Row::study).toList(),rows.size()>limit?cursor.after(last.position(),last.study().id()):null,cursor.asOf());
    }
    public List<FrozenNoteBinding> resolveBindings(String owner,List<NoteBindingInput> inputs) {
        if(inputs==null)return List.of();if(inputs.size()>1000)throw new IllegalArgumentException("笔记引用过多");
        var result=new ArrayList<FrozenNoteBinding>();
        for(var input:inputs) {
            if(input==null || input.sourceHash()==null || !input.sourceHash().matches("[a-f0-9]{64}"))throw new IllegalArgumentException("笔记引用哈希无效");
            NoteStudyRevision study=null;var key=input.legacyKey();
            if(input.revisionId()!=null)study=findOwned(owner,input.revisionId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"研究版本不可读取"));
            else if(key!=null) {
                ScenarioRecordValidator.require(input.sourceHash().equals(key.sourceHash()) && Set.of("document","fragment").contains(key.level()) && key.tagVersion()>0,"旧引用键无效");
                study=jdbc.sql("""
                    select study_payload_text from note_study_revision where owner_id=:owner and channel=:channel and legacy_record_id=:legacy
                    and legacy_level=:level and source_hash=:hash and legacy_tag_version=:version
                    """).param("owner",owner).param("channel",key.channel()).param("legacy",key.legacyRecordId()).param("level",key.level()).param("hash",key.sourceHash())
                    .param("version",key.tagVersion()).query(String.class).optional().map(s->ResearchJson.JSON.readValue(s,NoteStudyRevision.class)).orElse(null);
            }
            if(study!=null) {
                ScenarioRecordValidator.require(study.sourceHash().equals(input.sourceHash()),"引用原文版本不匹配");
                if(key!=null && input.inlineVersion()!=null && !ResearchJson.canonical(study.payload()).equals(ResearchJson.canonical(input.inlineVersion())))
                    throw new ResponseStatusException(HttpStatus.CONFLICT,"同一旧标签版本的解释内容冲突");
            }
            result.add(new FrozenNoteBinding(study==null?"unresolved":"resolved",study==null?null:study.id(),input.sourceHash(),key,input.inlineVersion(),study));
        }
        return List.copyOf(result);
    }
}

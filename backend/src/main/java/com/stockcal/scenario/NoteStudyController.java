package com.stockcal.scenario;
import static com.stockcal.scenario.ScenarioContracts.*;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1/note-studies")
public class NoteStudyController {
    private final NoteStudyService notes;
    public NoteStudyController(NoteStudyService notes){this.notes=notes;}
    @PostMapping NoteStudyRevision save(Principal p,@RequestHeader(value="X-Client-Id",required=false) String client,@RequestBody StudyImport body){return notes.importRevision(ResearchIdentity.resolve(p,client),body);}
    @GetMapping Page<NoteStudyRevision> list(Principal p,@RequestHeader(value="X-Client-Id",required=false) String client,
        @RequestParam(required=false) String file,@RequestParam(required=false) String cursor,@RequestParam(defaultValue="25") int limit){return notes.page(ResearchIdentity.resolve(p,client),file,cursor,limit);}
}
